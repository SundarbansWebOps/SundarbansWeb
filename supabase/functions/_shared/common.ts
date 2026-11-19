// Shared helpers for the Members Lounge Edge Functions (spec §16).
//
// Every function:
//   1. verifies the caller's session with Supabase Auth (auth.getUser on the bearer token),
//   2. asks the database whether that user is an active Super Admin (svc_assert_super_admin,
//      which calls private.is_super_admin_id) BEFORE reading the request body,
//   3. only then uses the secret key for Auth Admin API calls.
// The secret key is read from the environment and never leaves the function.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// Prefer the new secret key (sb_secret_...); fall back to the legacy service_role key.
function secretKey() {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    const key = JSON.parse(keys)['default'];
    if (key) return key;
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  throw new Error('No secret key available in the function environment');
}
export const admin = createClient(SUPABASE_URL, secretKey(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
// CORS: browsers are allowed only from the house's own sites (below) plus any origins listed in the
// ALLOWED_ORIGINS secret (comma-separated). Origins are not secret; keeping the house's own here
// means a mistyped secret can never lock the site out. Other origins get no CORS headers; curl
// still works. An entry may use "*" inside a host label, e.g. Vercel previews:
// https://sundarbans-*-sundarbans-projects.vercel.app. Every "*" matches letters, digits and "-"
// only (never a dot); everything else is matched literally. Tokens are sent as bearer headers, not
// cookies, so another origin cannot borrow a member's session through CORS.
const HOUSE_ORIGINS = [
  'https://sundarbans.iitmbs.org',
  'https://sundarbans-testing.vercel.app',
  'https://sundarbans-*-sundarbans-projects.vercel.app',
  'http://localhost:5173',
];
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const allowedOrigins = [...HOUSE_ORIGINS, ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',')]
  .map((o) =>
    o
      .trim()
      .replace(/^["']+|["']+$/g, '')
      .trim()
      .replace(/\/+$/, '')
  )
  .filter(Boolean)
  .map((o) =>
    o.includes('*') ? new RegExp(`^${o.split('*').map(escapeRegExp).join('[a-z0-9-]+')}$`) : o
  );
function originAllowed(origin) {
  return allowedOrigins.some((a) => (typeof a === 'string' ? a === origin : a.test(origin)));
}
// The request's Origin if it is one of the allowed sites, else null.
export function allowedOrigin(req) {
  const origin = req.headers.get('Origin');
  return origin && originAllowed(origin) ? origin : null;
}
function corsHeaders(req) {
  const origin = req.headers.get('Origin');
  if (!origin || !originAllowed(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
export class HttpError extends Error {
  status;
  code;
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
// Postgres SQLSTATE -> HTTP status, matching the RPC error codes used in the migrations.
const SQLSTATE_STATUS = {
  '42501': [403, 'forbidden'],
  '22023': [400, 'invalid_input'],
  P0002: [404, 'not_found'],
  PT409: [409, 'wrong_state'],
  '55000': [409, 'wrong_state'],
  '23505': [409, 'conflict'],
  '40001': [409, 'concurrent_change'],
};
// Calls a svc_* RPC with the secret key and turns database errors into HttpErrors.
export async function rpc(fn, args) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) {
    const [status, code] = SQLSTATE_STATUS[error.code ?? ''] ?? [500, 'database_error'];
    throw new HttpError(status, code, status === 500 ? 'Database error' : error.message);
  }
  return data;
}
// Returns the verified caller id. Auth checks the token signature, expiry and that the user
// still exists; the database then decides whether they are a Super Admin.
export async function requireSuperAdmin(req) {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'unauthenticated', 'Missing bearer token');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user)
    throw new HttpError(401, 'unauthenticated', 'Invalid or expired session');
  await rpc('svc_assert_super_admin', {
    p_actor: data.user.id,
  });
  return data.user.id;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function readJson(req) {
  if (!(req.headers.get('Content-Type') ?? '').includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Send application/json');
  }
  const text = await req.text();
  if (text.length > 10_000) throw new HttpError(413, 'too_large', 'Body too large');
  try {
    const body = JSON.parse(text);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, 'invalid_input', 'Body must be a JSON object');
  }
}
export function uuidField(body, name) {
  const v = body[name];
  if (typeof v !== 'string' || !UUID.test(v))
    throw new HttpError(400, 'invalid_input', `${name} must be a uuid`);
  return v.toLowerCase();
}
export function optionalString(body, name, max = 320) {
  const v = body[name];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' || v.length > max)
    throw new HttpError(400, 'invalid_input', `${name} must be a string`);
  return v;
}
// Wraps a handler: method/CORS handling, and uniform JSON errors (no stack traces leaked).
export function serve(name, handler) {
  Deno.serve(async (req) => {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: cors,
      });
    const respond = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
        },
      });
    if (req.method !== 'POST')
      return respond(405, {
        error: 'method_not_allowed',
      });
    try {
      const result = await handler(req);
      // A handler may return a ready Response (file streaming); it only gains the CORS headers.
      if (result instanceof Response) {
        const headers = new Headers(result.headers);
        for (const [k, v] of Object.entries(cors)) headers.set(k, v);
        return new Response(result.body, { status: result.status, headers });
      }
      return respond(200, result);
    } catch (e) {
      if (e instanceof HttpError)
        return respond(e.status, {
          error: e.code,
          message: e.message,
        });
      console.error(`${name}:`, e);
      return respond(500, {
        error: 'internal_error',
      });
    }
  });
}
