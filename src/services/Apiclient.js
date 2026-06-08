// ─── services/apiClient.js ────────────────────────────────────────────────────
//
// Shared low-level HTTP client.
// All API files import { get, post, put, del } from './apiClient'.
// Only touch this file when you need to change auth headers, timeouts, or
// base-URL logic — never for screen-specific concerns.
// ─────────────────────────────────────────────────────────────────────────────

// Oracle ORDS base — every endpoint is relative to this.
// If you have a staging vs production split, swap this value via an env var:
//   const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://...';
export const BASE_URL =
  'https://g8616730609ac5b-clatrx.adb.ap-singapore-1.oraclecloudapps.com/ords/xtd/fpl_mobile';

// ── Default headers ───────────────────────────────────────────────────────────
// Add Authorization, x-api-key, etc. here once your backend needs them.
const defaultHeaders = () => ({
  'Content-Type': 'application/json',
  // 'Authorization': `Bearer ${getToken()}`,
});

// ── Response handler ──────────────────────────────────────────────────────────
// Throws a descriptive Error for any non-2xx response so callers only
// need a single catch block.
//
// For Oracle ORDS errors the body is always JSON even on failure:
//   HTTP 500  → { "status":"error", "message":"ORA-XXXXX: ..." }  (SQLERRM from WHEN OTHERS)
//   HTTP 404  → { "status":"error", "message":"Batch ID X tidak ditemukan" }
//   HTTP 403  → plain text or ORDS HTML
//
const handleResponse = async (res) => {
  if (res.ok) return res.json();

  const bodyText = await res.text().catch(() => '');

  // Try to parse as JSON first — Oracle always sends { status, message } on errors
  let oracleMessage = null;
  try {
    const json = JSON.parse(bodyText);
    if (json?.message) oracleMessage = String(json.message);
  } catch (_) { /* not JSON, fall through */ }

  // Give actionable messages for common ORDS config mistakes
  if (res.status === 403) {
    throw new Error(
      `HTTP 403 — ORDS auth required.\n\n` +
      `Go to: REST Workshop → Modules → fpl_mobile\n` +
      `→ set the handler "Auth Required" = No, then publish.`
    );
  }
  if (res.status === 404) {
    throw new Error(
      oracleMessage ??
      `HTTP 404 — endpoint not found.\n\nCheck the ORDS module template path in Oracle APEX.`
    );
  }
  if (res.status === 405) {
    throw new Error(
      `HTTP 405 — method not allowed.\n\nVerify the ORDS handler method is set to POST.`
    );
  }
  if (res.status === 500 || res.status === 555) {
    // Surface the Oracle SQLERRM directly so you know exactly what failed in PL/SQL
    throw new Error(
      oracleMessage
        ? `Oracle error (HTTP ${res.status}):\n${oracleMessage}`
        : `HTTP ${res.status} — ${bodyText.slice(0, 400)}`
    );
  }

  throw new Error(`HTTP ${res.status} ${res.statusText}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ''}`);
};

// ── HTTP verbs ────────────────────────────────────────────────────────────────

/** GET  BASE_URL + path */
export const get = (path) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: defaultHeaders(),
  }).then(handleResponse);

/** POST BASE_URL + path with a JSON body */
export const post = (path, body) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  }).then(handleResponse);

/** PUT  BASE_URL + path with a JSON body */
export const put = (path, body) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  }).then(handleResponse);

/** DELETE BASE_URL + path */
export const del = (path) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: defaultHeaders(),
  }).then(handleResponse);

// ── ORDS helper ───────────────────────────────────────────────────────────────
// Oracle ORDS always wraps rows in { "items": [...] }.
// Call this after get() when you need the raw array.
export const ordsItems = (json) =>
  Array.isArray(json?.items) ? json.items : [];