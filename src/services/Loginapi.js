// ─── services/Loginapi.js ─────────────────────────────────────────────────────
//
// LOGIN — POSTs { username, password } to POST /validate_user
//
// The ORDS handler is a PL/SQL block that calls:
//   APEX_UTIL.IS_LOGIN_PASSWORD_VALID(p_username, p_password)
//
// ORDS automatically maps the JSON body keys → :username / :password bind vars.
//
// ── ORDS Handler setup ────────────────────────────────────────────────────────
//  Module   : fpl_mobile
//  Template : validate_user
//  Method   : POST          ← POST, not GET
//  Type     : PL/SQL Block
//  Auth     : No Auth Required  ← must be public
//  SQL      : paste validate_user_ORDS.sql
//
// ── Response shapes ───────────────────────────────────────────────────────────
//  Success → HTTP 200  { status:'success', code:'SUCCESS', db_username, email, full_name }
//  Failure → HTTP 401  { status:'error',   code:'USER_NOT_FOUND' | 'WRONG_PASSWORD' | 'ACCOUNT_LOCKED' }
//  Error   → HTTP 500  { status:'error',   code:'SERVER_ERROR', message: '...' }
//
// ─────────────────────────────────────────────────────────────────────────────

import { post } from './Apiclient';

// ─────────────────────────────────────────────────────────────────────────────
// BYPASS_MODE — set true to skip ORDS entirely during development.
// Any username/password will succeed. Set back to false for production.
// ─────────────────────────────────────────────────────────────────────────────
const BYPASS_MODE = false;

// ── Typed error messages shown in the UI ─────────────────────────────────────
const MESSAGES = {
  USER_NOT_FOUND:  'Username not found. Please check and try again.',
  WRONG_PASSWORD:  'Incorrect password. Please try again.',
  ACCOUNT_LOCKED:  'Your account is locked. Please contact the administrator.',
  MISSING_PARAMS:  'Username and password are required.',
  SERVER_ERROR:    'Server error. Please try again later.',
};

// ─────────────────────────────────────────────────────────────────────────────
// loginWithApex
//
// Called as: loginWithApex(username, password)   ← two separate string args
//
// POST /validate_user  body: { username, password }
//
// Returns : { username, email, fullName, status:'success' }
// Throws  : Error with .code for typed UI handling in LoginScreen
// ─────────────────────────────────────────────────────────────────────────────
export const loginWithApex = async (username, password) => {  // ← FIX: two args, not destructured object

  // ── Dev bypass ────────────────────────────────────────────────────────────
  if (BYPASS_MODE) {
    console.warn('[loginWithApex] ⚠️  BYPASS_MODE ON — skipping ORDS call');
    await new Promise((r) => setTimeout(r, 600));
    return {
      username: username.trim() || 'DEV_USER',
      email:    'dev@company.com',
      fullName: 'Dev User',
      status:   'success',
    };
  }

  console.log('[loginWithApex] -> POST /validate_user  user:', username.trim());

  let json;
  try {
    // post() from Apiclient sends:
    //   POST BASE_URL/validate_user
    //   Content-Type: application/json
    //   Body: { "username": "ADMIN", "password": "Tohnga1$123@" }
    //
    // ORDS maps body keys → :username and :password bind vars automatically.
    json = await post('/validate_user', {
      username: username.trim(),
      password: password,
    });
  } catch (err) {
    const msg = err.message ?? '';
    console.error('[loginWithApex] ORDS error:', msg);

    // Apiclient throws "HTTP 401 — <body>" on auth failure from PL/SQL :status := 401
    // Try to parse the JSON body that ORDS included in the error text
    const bodyMatch = msg.match(/—\s*(.+)$/s);
    if (bodyMatch) {
      try {
        const errJson = JSON.parse(bodyMatch[1].trim());
        const code    = errJson?.code    ?? 'WRONG_PASSWORD';
        const message = errJson?.message ?? MESSAGES[code] ?? msg;
        throw Object.assign(new Error(message), { code });
      } catch (parseErr) {
        if (parseErr.code) throw parseErr;  // re-throw typed error
      }
    }

    // Fallback messages based on HTTP status code in the error string
    if (msg.includes('401')) {
      throw Object.assign(
        new Error('Invalid username or password.'),
        { code: 'WRONG_PASSWORD' }
      );
    }
    if (msg.includes('403')) {
      throw Object.assign(
        new Error(
          'ORDS access denied (HTTP 403).\n\n' +
          'Check that the /validate_user handler has:\n' +
          '  • Method = POST\n' +
          '  • Auth Required = No\n' +
          '  • Status = Published'
        ),
        { code: 'ORDS_CONFIG_ERROR' }
      );
    }
    if (msg.includes('404')) {
      throw Object.assign(
        new Error(
          '/validate_user endpoint not found (HTTP 404).\n\n' +
          'Create the POST handler in your fpl_mobile ORDS module.'
        ),
        { code: 'ORDS_CONFIG_ERROR' }
      );
    }

    throw err;  // network or unknown error
  }

  console.log('[loginWithApex] response:', JSON.stringify(json));

  // ── Handle response from PL/SQL block ─────────────────────────────────────
  const status = String(json?.status ?? '').toLowerCase();
  const code   = String(json?.code   ?? '');

  if (status === 'error') {
    const msg = json?.message ?? MESSAGES[code] ?? 'Login failed.';
    throw Object.assign(new Error(msg), { code });
  }

  if (status !== 'success') {
    throw Object.assign(
      new Error('Unexpected response from server.'),
      { code: 'SERVER_ERROR' }
    );
  }

  // ── All good ──────────────────────────────────────────────────────────────
  return {
    username: json?.db_username ?? username.trim(),
    email:    json?.email       ?? '',
    fullName: json?.full_name   ?? '',
    status:   'success',
  };
};