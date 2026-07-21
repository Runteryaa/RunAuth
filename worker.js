/**
 * RunAuth - Centralized OAuth 2.0 / OIDC Identity Provider Gateway
 * Cloudflare Worker + Oracle Autonomous Database (via ORDS)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    try {
      if (path === "/" || path === "/health") {
        const issuer = `${url.protocol}//${url.host}`;
        return jsonResponse({
          status: "ok",
          service: "RunAuth Identity Provider Gateway",
          issuer,
          login_portal: `${issuer}/oauth/authorize`,
          oidc_config: `${issuer}/.well-known/openid-configuration`,
          timestamp: new Date().toISOString()
        });
      }

      if (path === "/.well-known/openid-configuration") {
        const issuer = `${url.protocol}//${url.host}`;
        return jsonResponse({
          issuer,
          authorization_endpoint: `${issuer}/oauth/authorize`,
          token_endpoint: `${issuer}/oauth/token`,
          userinfo_endpoint: `${issuer}/oauth/userinfo`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["HS256"]
        });
      }

      // Process Login
      if (path === "/api/auth/login" && request.method === "POST") {
        const { email, password, clientId, redirectUri, state } = await request.json();

        if (!email || !password) {
          return jsonResponse({ error: "Email and password are required" }, 400);
        }

        const passwordHash = await hashPassword(password);
        const users = await dbQuery(
          env,
          "SELECT id, email FROM runauth_users WHERE email = :1 AND password_hash = :2",
          [email.trim().toLowerCase(), passwordHash]
        );

        if (!users || !users.items || users.items.length === 0) {
          return jsonResponse({ error: "Invalid email or password" }, 401);
        }

        const user = users.items[0];
        const userId = user.ID || user.id;

        const authCode = "ac_" + crypto.randomUUID().replace(/-/g, "");

        await dbQuery(
          env,
          "INSERT INTO runauth_sessions (id, user_id, expires_at) VALUES (:1, :2, SYSTIMESTAMP + INTERVAL '10' MINUTE)",
          [authCode, userId]
        );

        const targetRedirect = `${redirectUri}?code=${authCode}&state=${encodeURIComponent(state)}`;
        return jsonResponse({ success: true, redirectUrl: targetRedirect });
      }

      // Process Registration
      if (path === "/api/auth/register" && request.method === "POST") {
        const { email, password, clientId, redirectUri, state } = await request.json();

        if (!email || !password || password.length < 6) {
          return jsonResponse({ error: "Password must be at least 6 characters" }, 400);
        }

        const existing = await dbQuery(env, "SELECT id FROM runauth_users WHERE email = :1", [email.trim().toLowerCase()]);
        if (existing && existing.items && existing.items.length > 0) {
          return jsonResponse({ error: "An account with this email already exists" }, 409);
        }

        const userId = "usr_" + crypto.randomUUID().replace(/-/g, "");
        const passwordHash = await hashPassword(password);

        await dbQuery(
          env,
          "INSERT INTO runauth_users (id, email, password_hash) VALUES (:1, :2, :3)",
          [userId, email.trim().toLowerCase(), passwordHash]
        );

        const authCode = "ac_" + crypto.randomUUID().replace(/-/g, "");

        await dbQuery(
          env,
          "INSERT INTO runauth_sessions (id, user_id, expires_at) VALUES (:1, :2, SYSTIMESTAMP + INTERVAL '10' MINUTE)",
          [authCode, userId]
        );

        const targetRedirect = `${redirectUri}?code=${authCode}&state=${encodeURIComponent(state)}`;
        return jsonResponse({ success: true, redirectUrl: targetRedirect });
      }

      // OAuth Token Exchange
      if (path === "/oauth/token" && request.method === "POST") {
        let body;
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          body = await request.json();
        } else {
          const formData = await request.formData();
          body = Object.fromEntries(formData.entries());
        }

        const { code, client_id, client_secret } = body;

        if (!code || !client_id) {
          return jsonResponse({ error: "invalid_request", error_description: "Missing code or client_id" }, 400);
        }

        const apps = await dbQuery(env, "SELECT client_id, client_secret FROM runauth_apps WHERE client_id = :1", [client_id]);
        if (!apps || !apps.items || apps.items.length === 0) {
          return jsonResponse({ error: "invalid_client", error_description: "Unknown client_id" }, 401);
        }

        const sessions = await dbQuery(env, "SELECT id, user_id FROM runauth_sessions WHERE id = :1", [code]);
        if (!sessions || !sessions.items || sessions.items.length === 0) {
          return jsonResponse({ error: "invalid_grant", error_description: "Invalid or expired authorization code" }, 400);
        }

        const session = sessions.items[0];
        const userId = session.USER_ID || session.user_id;

        const userRes = await dbQuery(env, "SELECT id, email FROM runauth_users WHERE id = :1", [userId]);
        const user = userRes?.items?.[0] || { ID: userId, EMAIL: "" };

        await dbQuery(env, "DELETE FROM runauth_sessions WHERE id = :1", [code]);

        const secret = env.JWT_SECRET || "runauth_super_secret_jwt_key_2026";
        const now = Math.floor(Date.now() / 1000);
        const payload = {
          iss: `${url.protocol}//${url.host}`,
          sub: user.ID || user.id,
          aud: client_id,
          email: user.EMAIL || user.email,
          iat: now,
          exp: now + 86400
        };

        const accessToken = await createJWT(payload, secret);

        return jsonResponse({
          access_token: accessToken,
          id_token: accessToken,
          token_type: "Bearer",
          expires_in: 86400
        });
      }

      // UserInfo Endpoint
      if (path === "/oauth/userinfo" && request.method === "GET") {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.replace(/^Bearer\s+/i, "");

        if (!token) {
          return jsonResponse({ error: "unauthorized", error_description: "Missing token" }, 401);
        }

        const secret = env.JWT_SECRET || "runauth_super_secret_jwt_key_2026";
        const payload = await verifyJWT(token, secret);

        if (!payload) {
          return jsonResponse({ error: "invalid_token", error_description: "Token verification failed" }, 401);
        }

        return jsonResponse({
          sub: payload.sub,
          email: payload.email,
          email_verified: true
        });
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (err) {
      return jsonResponse({ error: "Internal server error", details: err.message }, 500);
    }
  }
};

async function dbQuery(env, sql, bindParams = []) {
  const ordsUrl = env.ORDS_URL || "https://GB0ABB62E885E33-RUNAUTH.adb.eu-frankfurt-1.oraclecloudapps.com/ords/admin/_/sql";
  const user = env.ORDS_USER || "admin";
  const pass = env.ORDS_PASSWORD || "Elmaadamadam31";

  const credentials = btoa(`${user}:${pass}`);
  let formattedSql = sql;
  if (bindParams && bindParams.length > 0) {
    bindParams.forEach((val, idx) => {
      const placeholder = new RegExp(`:${idx + 1}\\b`, "g");
      const safeVal = typeof val === "string" ? `'${val.replace(/'/g, "''")}'` : val;
      formattedSql = formattedSql.replace(placeholder, safeVal);
    });
  }

  const response = await fetch(ordsUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/sql"
    },
    body: formattedSql
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ORDS DB Error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  if (result.items && result.items[0]) {
    return result.items[0].resultSet || { items: [] };
  }
  return { items: [] };
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "_runauth_salt_2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function createJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const base64Header = base64UrlEncode(JSON.stringify(header));
  const base64Payload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${base64Header}.${base64Payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signatureInput));
  const base64Signature = base64UrlEncode(signature);

  return `${signatureInput}.${base64Signature}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const signatureInput = `${headerB64}.${payloadB64}`;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signature = base64UrlDecode(signatureB64);
    const isValid = await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(signatureInput));

    if (!isValid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

function base64UrlEncode(input) {
  let bytes;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = input;
  }
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
