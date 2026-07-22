/**
 * RunAuth - Centralized OAuth 2.0 / OIDC Identity Provider Gateway
 * Cloudflare Worker + Oracle Autonomous Database (via ORDS)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const reqOrigin = request.headers.get("Origin") || "*";

    // Helper for CORS-compliant JSON Responses
    const jsonResponse = (data, status = 200, extraHeaders = {}) => {
      // Browsers reject Access-Control-Allow-Origin: * when credentials mode is 'include'
      const allowOrigin = reqOrigin !== "*" ? reqOrigin : "http://localhost:3000";
      const headers = new Headers({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
      });

      if (extraHeaders) {
        Object.entries(extraHeaders).forEach(([k, v]) => headers.set(k, v));
      }

      return new Response(JSON.stringify(data), { status, headers });
    };

    if (request.method === "OPTIONS") {
      return handleCORS(reqOrigin);
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

        const sessionId = generateSecureToken("ra_sess_");
        const authCode = generateSecureToken("ra_code_");

        await dbQuery(
          env,
          "INSERT INTO runauth_sessions (id, user_id, expires_at) VALUES (:1, :2, SYSTIMESTAMP + INTERVAL '30' DAY)",
          [sessionId, userId]
        );

        if (redirectUri) {
          await dbQuery(
            env,
            "INSERT INTO runauth_sessions (id, user_id, expires_at) VALUES (:1, :2, SYSTIMESTAMP + INTERVAL '10' MINUTE)",
            [authCode, userId]
          );
        }
        if (clientId) await recordUserGrant(env, userId, clientId);

        const targetRedirect = redirectUri ? `${redirectUri}?code=${authCode}&state=${encodeURIComponent(state || "")}` : null;
        return jsonResponse(
          { success: true, redirectUrl: targetRedirect, sessionToken: sessionId },
          200,
          { "Set-Cookie": `runauth_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=2592000` }
        );
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
          "INSERT INTO runauth_users (id, email, password_hash, name, avatar) VALUES (:1, :2, :3, :4, :5)",
          [
            userId,
            email.trim().toLowerCase(),
            passwordHash,
            name || email.split('@')[0],
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`
          ]
        );

        const sessionId = generateSecureToken("ra_sess_");
        const authCode = generateSecureToken("ra_code_");

        await dbQuery(
          env,
          "INSERT INTO runauth_sessions (id, user_id, expires_at) VALUES (:1, :2, SYSTIMESTAMP + INTERVAL '30' DAY)",
          [sessionId, userId]
        );

        if (redirectUri) {
          await dbQuery(
            env,
            "INSERT INTO runauth_sessions (id, user_id, expires_at) VALUES (:1, :2, SYSTIMESTAMP + INTERVAL '10' MINUTE)",
            [authCode, userId]
          );
        }
        if (clientId) await recordUserGrant(env, userId, clientId);

        const targetRedirect = redirectUri ? `${redirectUri}?code=${authCode}&state=${encodeURIComponent(state || "")}` : null;
        return jsonResponse(
          { success: true, redirectUrl: targetRedirect, sessionToken: sessionId },
          200,
          { "Set-Cookie": `runauth_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=2592000` }
        );
      }

      // Authorize existing session (for SSO Continue as...)
      if (path === "/api/auth/authorize-session" && request.method === "POST") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const match = cookieHeader.match(/runauth_session=([^;]+)/);
        if (!match) {
          return jsonResponse({ error: "No active session" }, 401);
        }
        const sessionId = match[1].trim();
        const sessions = await dbQuery(env, "SELECT user_id FROM runauth_sessions WHERE id = :1", [sessionId]);
        if (!sessions || !sessions.items || sessions.items.length === 0) {
          return jsonResponse({ error: "Invalid or expired session" }, 401);
        }
        const userId = sessions.items[0].USER_ID || sessions.items[0].user_id;
        let body = {};
        try { body = await request.json(); } catch(e) {}
        if (body.clientId) await recordUserGrant(env, userId, body.clientId);

        const authCode = generateSecureToken("ra_code_");
        await dbQuery(
          env,
          "INSERT INTO runauth_sessions (id, user_id, expires_at) VALUES (:1, :2, SYSTIMESTAMP + INTERVAL '10' MINUTE)",
          [authCode, userId]
        );
        return jsonResponse({ success: true, code: authCode });
      }

      // Logout
      if (path === "/api/auth/logout" && request.method === "POST") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const match = cookieHeader.match(/runauth_session=([^;]+)/);
        if (match) {
          const sessionId = match[1].trim();
          await dbQuery(env, "DELETE FROM runauth_sessions WHERE id = :1", [sessionId]);
        }
        return jsonResponse(
          { success: true },
          200,
          { "Set-Cookie": "runauth_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0" }
        );
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

        const userRes = await dbQuery(env, "SELECT id, email, name, avatar FROM runauth_users WHERE id = :1", [userId]);
        const user = userRes?.items?.[0] || { ID: userId, EMAIL: "" };

        await dbQuery(env, "DELETE FROM runauth_sessions WHERE id = :1", [code]);
        await recordUserGrant(env, userId, client_id);

        const secret = env.JWT_SECRET || "runauth_super_secret_jwt_key_2026";
        const now = Math.floor(Date.now() / 1000);
        const userEmail = user.EMAIL || user.email || "";
        const payload = {
          jti: generateSecureToken("jti_"),
          iss: `${url.protocol}//${url.host}`,
          sub: user.ID || user.id,
          aud: client_id,
          email: userEmail,
          name: user.NAME || user.name || (userEmail ? userEmail.split('@')[0] : 'Kullanıcı'),
          avatar: user.AVATAR || user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userEmail)}`,
          auth_time: now,
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
        let token = authHeader.replace(/^Bearer\s+/i, "").trim();

        // If no Authorization header, check Cookie header for runauth_session
        if (!token) {
          const cookieHeader = request.headers.get("Cookie") || "";
          const match = cookieHeader.match(/runauth_session=([^;]+)/);
          if (match) {
            token = match[1].trim();
          }
        }

        if (!token) {
          return jsonResponse({ error: "unauthorized", error_description: "Missing token or session cookie" }, 401);
        }

        // Check if token is in Oracle DB sessions table or JWT
        let userId = null;
        const sessions = await dbQuery(env, "SELECT user_id FROM runauth_sessions WHERE id = :1", [token]);
        if (sessions && sessions.items && sessions.items.length > 0) {
          userId = sessions.items[0].USER_ID || sessions.items[0].user_id;
        } else {
          const secret = env.JWT_SECRET || "runauth_super_secret_jwt_key_2026";
          const payload = await verifyJWT(token, secret);
          if (payload) userId = payload.sub;
        }

        if (!userId) {
          return jsonResponse({ error: "invalid_token", error_description: "Token verification failed" }, 401);
        }

        const userRes = await dbQuery(env, "SELECT id, email, name, avatar FROM runauth_users WHERE id = :1", [userId]);
        const user = userRes?.items?.[0] || { ID: userId, EMAIL: "" };
        const userEmail = user.EMAIL || user.email || "";
        const userName = user.NAME || user.name || (userEmail ? userEmail.split('@')[0] : 'Kullanıcı');
        const userAvatar = user.AVATAR || user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userEmail)}`;

        let connectedApps = [];
        try {
          const appsRes = await dbQuery(
            env,
            "SELECT g.client_id, g.granted_at, g.last_used_at, a.app_name AS app_name FROM runauth_user_grants g LEFT JOIN runauth_apps a ON g.client_id = a.client_id WHERE g.user_id = :1 ORDER BY g.last_used_at DESC",
            [userId]
          );
          if (appsRes && appsRes.items) {
            connectedApps = appsRes.items.map(i => ({
              id: i.CLIENT_ID || i.client_id,
              name: i.APP_NAME || i.app_name || (i.CLIENT_ID || i.client_id).replace(/-client$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              icon: (i.CLIENT_ID || i.client_id).toLowerCase().includes('practi') ? '📚' : '🌐',
              connectedAt: i.GRANTED_AT || i.granted_at || "2026-07-22"
            }));
          }
        } catch (e) {}

        return jsonResponse({
          sub: user.ID || user.id || userId,
          email: userEmail,
          name: userName,
          avatar: userAvatar,
          email_verified: true,
          connected_apps: connectedApps
        });
      }

      // Revoke Connected App Grant
      if (path.startsWith("/api/user/grants/") && request.method === "DELETE") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const authHeader = request.headers.get("Authorization") || "";
        let token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
          const match = cookieHeader.match(/runauth_session=([^;]+)/);
          if (match) token = match[1].trim();
        }
        if (!token) return jsonResponse({ error: "unauthorized" }, 401);
        const sessions = await dbQuery(env, "SELECT user_id FROM runauth_sessions WHERE id = :1", [token]);
        if (!sessions || !sessions.items || sessions.items.length === 0) return jsonResponse({ error: "invalid_session" }, 401);
        const userId = sessions.items[0].USER_ID || sessions.items[0].user_id;
        const clientId = path.replace("/api/user/grants/", "").trim();
        await dbQuery(env, "DELETE FROM runauth_user_grants WHERE user_id = :1 AND client_id = :2", [userId, clientId]);
        return jsonResponse({ success: true });
      }

      // Update Profile Endpoint
      if (path === "/api/user/profile" && request.method === "POST") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const authHeader = request.headers.get("Authorization") || "";
        let token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
          const match = cookieHeader.match(/runauth_session=([^;]+)/);
          if (match) token = match[1].trim();
        }
        if (!token) {
          return jsonResponse({ error: "unauthorized" }, 401);
        }
        const sessions = await dbQuery(env, "SELECT user_id FROM runauth_sessions WHERE id = :1", [token]);
        if (!sessions || !sessions.items || sessions.items.length === 0) {
          return jsonResponse({ error: "invalid_session" }, 401);
        }
        const userId = sessions.items[0].USER_ID || sessions.items[0].user_id;
        const { name, avatar } = await request.json();

        await dbQuery(
          env,
          "UPDATE runauth_users SET name = :1, avatar = :2 WHERE id = :3",
          [name || "", avatar || "", userId]
        );
        return jsonResponse({ success: true, name, avatar });
      }

      // Update Password Endpoint
      if (path === "/api/user/password" && request.method === "POST") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const authHeader = request.headers.get("Authorization") || "";
        let token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) {
          const match = cookieHeader.match(/runauth_session=([^;]+)/);
          if (match) token = match[1].trim();
        }
        if (!token) {
          return jsonResponse({ error: "unauthorized" }, 401);
        }
        const sessions = await dbQuery(env, "SELECT user_id FROM runauth_sessions WHERE id = :1", [token]);
        if (!sessions || !sessions.items || sessions.items.length === 0) {
          return jsonResponse({ error: "invalid_session" }, 401);
        }
        const userId = sessions.items[0].USER_ID || sessions.items[0].user_id;
        const { currentPassword, newPassword } = await request.json();

        if (!newPassword || newPassword.length < 6) {
          return jsonResponse({ error: "Yeni şifre en az 6 karakter olmalıdır." }, 400);
        }

        const userRes = await dbQuery(env, "SELECT password_hash FROM runauth_users WHERE id = :1", [userId]);
        const user = userRes?.items?.[0];
        if (!user) {
          return jsonResponse({ error: "Kullanıcı bulunamadı." }, 404);
        }
        const currentHash = await hashPassword(currentPassword || "");
        const storedHash = user.PASSWORD_HASH || user.password_hash;
        if (currentHash !== storedHash) {
          return jsonResponse({ error: "Mevcut şifreniz yanlış." }, 400);
        }

        const newHash = await hashPassword(newPassword);
        await dbQuery(env, "UPDATE runauth_users SET password_hash = :1 WHERE id = :2", [newHash, userId]);
        return jsonResponse({ success: true });
      }

      // ==========================================
      // PractiDE Words API (/v1/words)
      // ==========================================
      if (path.startsWith("/v1/practide/words") || path.startsWith("/v1/words")) {
        const prefix = path.startsWith("/v1/practide/words") ? "/v1/practide/words" : "/v1/words";
        const cleanPath = path.replace(/\/$/, ""); // Remove trailing slash
        const wordId = cleanPath.startsWith(prefix + "/") ? cleanPath.replace(prefix + "/", "") : null;

        // GET words list
        if (request.method === "GET" && (!wordId || wordId === "")) {
          let userId = null;
          const qParam = url.searchParams.get("q");
          if (qParam) {
            try {
              const parsed = JSON.parse(qParam);
              userId = parsed.user_id;
            } catch (e) {}
          }

          let sql = "SELECT id, user_id, word, article, meaning_tr, meaning_en, learned, streak, created_at FROM practide_words";
          let params = [];
          if (userId) {
            sql += " WHERE user_id = :1";
            params.push(userId);
          }
          sql += " ORDER BY created_at DESC";

          const result = await dbQuery(env, sql, params);
          const rawItems = result.items || [];
          const items = rawItems.map(item => ({
            id: item.ID || item.id,
            user_id: item.USER_ID || item.user_id,
            word: item.WORD || item.word,
            article: item.ARTICLE || item.article,
            meaning_tr: item.MEANING_TR || item.meaning_tr,
            meaning_en: item.MEANING_EN || item.meaning_en,
            learned: (item.LEARNED ?? item.learned ?? 0) === 1 || (item.LEARNED ?? item.learned) === true ? 1 : 0,
            streak: Number(item.STREAK ?? item.streak ?? 0),
            created_at: item.CREATED_AT || item.created_at
          }));

          return jsonResponse({ items });
        }

        // POST create word
        if (request.method === "POST" && (!wordId || wordId === "")) {
          const body = await request.json();
          const id = body.id || generateSecureToken("w_");
          const userId = body.user_id || "";
          const word = body.word || "";
          const article = body.article || "";
          const meaningTr = body.meaning_tr || "";
          const meaningEn = body.meaning_en || "";
          const learned = body.learned ? 1 : 0;
          const streak = Number(body.streak || 0);
          const createdAt = body.created_at || new Date().toISOString();

          await dbQuery(
            env,
            "INSERT INTO practide_words (id, user_id, word, article, meaning_tr, meaning_en, learned, streak, created_at) VALUES (:1, :2, :3, :4, :5, :6, :7, :8, :9)",
            [id, userId, word, article, meaningTr, meaningEn, learned, streak, createdAt]
          );

          return jsonResponse({ success: true, id }, 201);
        }

        // PUT update word
        if (request.method === "PUT" && wordId) {
          const body = await request.json();
          const word = body.word || "";
          const article = body.article || "";
          const meaningTr = body.meaning_tr || "";
          const meaningEn = body.meaning_en || "";
          const learned = body.learned ? 1 : 0;
          const streak = Number(body.streak || 0);

          await dbQuery(
            env,
            "UPDATE practide_words SET word = :1, article = :2, meaning_tr = :3, meaning_en = :4, learned = :5, streak = :6 WHERE id = :7",
            [word, article, meaningTr, meaningEn, learned, streak, wordId]
          );

          return jsonResponse({ success: true });
        }

        // DELETE word
        if (request.method === "DELETE" && wordId) {
          await dbQuery(env, "DELETE FROM practide_words WHERE id = :1", [wordId]);
          return jsonResponse({ success: true });
        }

        return jsonResponse({ error: "Invalid words method" }, 405);
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (err) {
      return jsonResponse({ error: "Internal server error", details: err.message }, 500);
    }
  }
async function recordUserGrant(env, userId, clientId) {
  if (!userId || !clientId) return;
  const nowIso = new Date().toISOString().split('T')[0];
  try {
    await dbQuery(
      env,
      `BEGIN
         MERGE INTO runauth_user_grants g
         USING (SELECT :1 AS user_id, :2 AS client_id FROM DUAL) s
         ON (g.user_id = s.user_id AND g.client_id = s.client_id)
         WHEN MATCHED THEN
           UPDATE SET last_used_at = :3
         WHEN NOT MATCHED THEN
           INSERT (user_id, client_id, granted_at, last_used_at)
           VALUES (s.user_id, s.client_id, :3, :3);
         COMMIT;
       END;`,
      [userId, clientId, nowIso]
    );
  } catch (e) {}
}

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

  if (/^\s*(INSERT|UPDATE|DELETE)\s+/i.test(formattedSql) && !/COMMIT/i.test(formattedSql)) {
    const cleanStmt = formattedSql.replace(/;\s*$/, "");
    formattedSql = `BEGIN ${cleanStmt}; COMMIT; END;`;
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

function generateSecureToken(prefix = "") {
  const array = new Uint8Array(64); // 512 bits of secure cryptographic entropy
  crypto.getRandomValues(array);
  const hex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  return prefix + hex;
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

function handleCORS(reqOrigin = "*") {
  const allowOrigin = reqOrigin !== "*" ? reqOrigin : "http://localhost:3000";
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400"
    }
  });
}
