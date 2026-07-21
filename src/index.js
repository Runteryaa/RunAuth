/**
 * RunAuth - Centralized OAuth 2.0 / OIDC Identity Provider Gateway
 * Cloudflare Worker + Oracle Autonomous Database (via ORDS)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enable CORS for API routes
    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    try {
      // 1. Health check
      if (path === "/health") {
        return jsonResponse({ status: "ok", service: "RunAuth Identity Provider", timestamp: new Date().toISOString() });
      }

      // 2. OIDC Discovery
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

      // 3. GET /oauth/authorize -> Render Login UI Portal
      if (path === "/oauth/authorize" && request.method === "GET") {
        const clientId = url.searchParams.get("client_id") || "practide-app-client";
        const redirectUri = url.searchParams.get("redirect_uri") || "";
        const state = url.searchParams.get("state") || "";

        // Verify client exists
        let appName = "Client App";
        if (clientId) {
          const appRes = await dbQuery(env, "SELECT app_name FROM runauth_apps WHERE client_id = :1", [clientId]);
          if (appRes && appRes.items && appRes.items.length > 0) {
            appName = appRes.items[0].APP_NAME || appRes.items[0].app_name || appName;
          }
        }

        return new Response(renderLoginUI({ clientId, redirectUri, state, appName }), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }

      // 4. POST /api/auth/login -> Process Login
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

        // Generate Auth Code
        const authCode = "ac_" + crypto.randomUUID().replace(/-/g, "");
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

        // Store session / auth code
        await dbQuery(
          env,
          "INSERT INTO runauth_sessions (id, user_id, expires_at) VALUES (:1, :2, TO_TIMESTAMP(:3, 'YYYY-MM-DD\"T\"HH24:MI:SS.FF3\"Z\"'))",
          [authCode, userId, expiresAt]
        );

        const targetRedirect = `${redirectUri}?code=${authCode}&state=${encodeURIComponent(state)}`;
        return jsonResponse({ success: true, redirectUrl: targetRedirect });
      }

      // 5. POST /api/auth/register -> Process Registration
      if (path === "/api/auth/register" && request.method === "POST") {
        const { email, password, clientId, redirectUri, state } = await request.json();

        if (!email || !password || password.length < 6) {
          return jsonResponse({ error: "Password must be at least 6 characters" }, 400);
        }

        // Check if user exists
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

        // Generate Auth Code
        const authCode = "ac_" + crypto.randomUUID().replace(/-/g, "");
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await dbQuery(
          env,
          "INSERT INTO runauth_sessions (id, user_id, expires_at) VALUES (:1, :2, TO_TIMESTAMP(:3, 'YYYY-MM-DD\"T\"HH24:MI:SS.FF3\"Z\"'))",
          [authCode, userId, expiresAt]
        );

        const targetRedirect = `${redirectUri}?code=${authCode}&state=${encodeURIComponent(state)}`;
        return jsonResponse({ success: true, redirectUrl: targetRedirect });
      }

      // 6. POST /oauth/token -> Exchange Auth Code for Access & ID Tokens
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

        // Verify client credentials
        const apps = await dbQuery(env, "SELECT client_id, client_secret FROM runauth_apps WHERE client_id = :1", [client_id]);
        if (!apps || !apps.items || apps.items.length === 0) {
          return jsonResponse({ error: "invalid_client", error_description: "Unknown client_id" }, 401);
        }

        // Verify session / auth code
        const sessions = await dbQuery(env, "SELECT id, user_id FROM runauth_sessions WHERE id = :1", [code]);
        if (!sessions || !sessions.items || sessions.items.length === 0) {
          return jsonResponse({ error: "invalid_grant", error_description: "Invalid or expired authorization code" }, 400);
        }

        const session = sessions.items[0];
        const userId = session.USER_ID || session.user_id;

        // Fetch user profile
        const userRes = await dbQuery(env, "SELECT id, email FROM runauth_users WHERE id = :1", [userId]);
        const user = userRes?.items?.[0] || { ID: userId, EMAIL: "" };

        // Clean up authorization code
        await dbQuery(env, "DELETE FROM runauth_sessions WHERE id = :1", [code]);

        // Generate JWT
        const secret = env.JWT_SECRET || "runauth_super_secret_jwt_key_2026";
        const now = Math.floor(Date.now() / 1000);
        const payload = {
          iss: `${url.protocol}//${url.host}`,
          sub: user.ID || user.id,
          aud: client_id,
          email: user.EMAIL || user.email,
          iat: now,
          exp: now + 86400 // 24 hours
        };

        const accessToken = await createJWT(payload, secret);
        const idToken = accessToken;

        return jsonResponse({
          access_token: accessToken,
          id_token: idToken,
          token_type: "Bearer",
          expires_in: 86400
        });
      }

      // 7. GET /oauth/userinfo -> Get User Profile
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
      console.error("RunAuth Worker Error:", err);
      return jsonResponse({ error: "Internal server error", details: err.message }, 500);
    }
  }
};

/* ========================================================================== */
/* HELPER FUNCTIONS & ORACLE ORDS DATABASE INTEGRATION                        */
/* ========================================================================== */

async function dbQuery(env, sql, bindParams = []) {
  const ordsUrl = env.ORDS_URL || "https://GB0ABB62E885E33-RUNAUTH.adb.eu-frankfurt-1.oraclecloudapps.com/ords/admin/_/sql";
  const user = env.ORDS_USER || "admin";
  const pass = env.ORDS_PASSWORD || "Elmaadamadam31";

  const credentials = btoa(`${user}:${pass}`);
  
  // Format bind variables if provided
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
      return null; // Expired
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

/* ========================================================================== */
/* STANDALONE ULTRA-SLEEK RUNAUTH LOGIN & REGISTER PORTAL UI                   */
/* ========================================================================== */

function renderLoginUI({ clientId, redirectUri, state, appName }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in with RunAuth</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    body {
      background-color: #080B13;
      color: #F3F4F6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }
    
    /* Dynamic Mesh Gradient Background */
    .bg-glow {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      filter: blur(120px);
      opacity: 0.45;
      pointer-events: none;
      animation: float 14s infinite alternate ease-in-out;
    }
    .glow-1 {
      top: -150px;
      left: -150px;
      background: radial-gradient(circle, #6366F1 0%, #a855f7 100%);
    }
    .glow-2 {
      bottom: -150px;
      right: -150px;
      background: radial-gradient(circle, #ec4899 0%, #3b82f6 100%);
    }

    @keyframes float {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(60px, 40px) scale(1.1); }
    }

    /* Container & Glassmorphism Card */
    .auth-card {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 440px;
      padding: 40px;
      background: rgba(17, 24, 39, 0.7);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.15);
      animation: fadeIn 0.6s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Header & Branding */
    .brand-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, #6366F1, #8B5CF6);
      border-radius: 16px;
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
      margin-bottom: 14px;
    }
    .brand-badge svg {
      width: 28px;
      height: 28px;
      fill: #FFFFFF;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #FFFFFF 30%, #9CA3AF 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .app-subtitle {
      font-size: 14px;
      color: #9CA3AF;
      margin-top: 6px;
    }
    .app-name {
      color: #818CF8;
      font-weight: 600;
    }

    /* Tab Switcher */
    .tabs {
      display: flex;
      background: rgba(31, 41, 55, 0.6);
      padding: 4px;
      border-radius: 12px;
      margin-bottom: 24px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .tab-btn {
      flex: 1;
      padding: 10px;
      text-align: center;
      background: transparent;
      border: none;
      color: #9CA3AF;
      font-size: 14px;
      font-weight: 500;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .tab-btn.active {
      background: #374151;
      color: #FFFFFF;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    /* Form Inputs */
    .input-group {
      margin-bottom: 20px;
    }
    .input-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #D1D5DB;
      margin-bottom: 8px;
    }
    .input-field {
      width: 100%;
      padding: 14px 16px;
      background: rgba(31, 41, 55, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      color: #FFFFFF;
      font-size: 15px;
      outline: none;
      transition: all 0.2s ease;
    }
    .input-field:focus {
      border-color: #6366F1;
      background: rgba(31, 41, 55, 0.7);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }

    /* Primary Action Button */
    .submit-btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
      color: #FFFFFF;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.35);
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .submit-btn:hover {
      opacity: 0.95;
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
    }
    .submit-btn:active {
      transform: translateY(0);
    }

    /* Notifications / Messages */
    .toast {
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13.5px;
      margin-bottom: 20px;
      display: none;
    }
    .toast.error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #FCA5A5;
      display: block;
    }

    .footer-note {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: #6B7280;
    }
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #FFF;
      animation: spin 0.8s linear infinite;
      display: none;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>

  <div class="bg-glow glow-1"></div>
  <div class="bg-glow glow-2"></div>

  <div class="auth-card">
    <div class="brand-header">
      <div class="brand-badge">
        <svg viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h1 class="brand-title">RunAuth</h1>
      <p class="app-subtitle">Continue to <span class="app-name">${escapeHTML(appName)}</span></p>
    </div>

    <div class="tabs">
      <button id="tab-login" class="tab-btn active" onclick="switchMode('login')">Sign In</button>
      <button id="tab-register" class="tab-btn" onclick="switchMode('register')">Create Account</button>
    </div>

    <div id="toast" class="toast"></div>

    <form id="authForm" onsubmit="handleSubmit(event)">
      <div class="input-group">
        <label class="input-label">Email Address</label>
        <input type="email" id="email" class="input-field" placeholder="name@example.com" required autocomplete="email">
      </div>

      <div class="input-group">
        <label class="input-label">Password</label>
        <input type="password" id="password" class="input-field" placeholder="••••••••" required autocomplete="current-password">
      </div>

      <button type="submit" id="submitBtn" class="submit-btn">
        <span id="btnText">Continue</span>
        <div id="btnSpinner" class="spinner"></div>
      </button>
    </form>

    <div class="footer-note">
      Protected by RunAuth SSO & Oracle Cloud Security
    </div>
  </div>

  <script>
    let mode = 'login';
    const clientId = "${escapeHTML(clientId)}";
    const redirectUri = "${escapeHTML(redirectUri)}";
    const state = "${escapeHTML(state)}";

    function switchMode(newMode) {
      mode = newMode;
      document.getElementById('tab-login').classList.toggle('active', mode === 'login');
      document.getElementById('tab-register').classList.toggle('active', mode === 'register');
      document.getElementById('btnText').textContent = mode === 'login' ? 'Continue' : 'Create Account';
      hideError();
    }

    function showError(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.className = 'toast error';
    }

    function hideError() {
      const toast = document.getElementById('toast');
      toast.className = 'toast';
    }

    async function handleSubmit(e) {
      e.preventDefault();
      hideError();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const btn = document.getElementById('submitBtn');
      const spinner = document.getElementById('btnSpinner');
      const btnText = document.getElementById('btnText');

      btn.disabled = true;
      spinner.style.display = 'block';
      btnText.style.opacity = '0.5';

      try {
        const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, clientId, redirectUri, state })
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          showError(data.error || 'Authentication failed. Please check your credentials.');
          btn.disabled = false;
          spinner.style.display = 'none';
          btnText.style.opacity = '1';
          return;
        }

        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        }
      } catch (err) {
        showError('Network error. Please try again.');
        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.style.opacity = '1';
      }
    }

    function escapeHTML(str) {
      return str ? str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      ) : '';
    }
  </script>
</body>
</html>`;
}

function escapeHTML(str) {
  return str ? str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  ) : '';
}
