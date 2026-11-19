// sign-form-banner
// POST { "form_id": uuid }   Caller: a signed-in member who may manage that form (svc_form_banner_target).
//
// Returns a short-lived signed Cloudinary upload for the form's banner, exactly as sign-event-image
// does for posters: folder sundarbans/forms/<form id>, formats jpg/png/webp, resize to at most
// 1600 px wide. The API secret never leaves this function.
//
// Secrets: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (Edge Function secrets).
import { admin, HttpError, readJson, rpc, serve, uuidField } from '../_shared/common.ts';
// lounge_forms.banner_url only accepts this account's delivery URLs (constraint lounge_forms_banner_cloudinary).
const EXPECTED_CLOUD = 'l59gy0g2';
async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
serve('sign-form-banner', async (req: Request) => {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'unauthenticated', 'Missing bearer token');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'unauthenticated', 'Invalid or expired session');
  const formId = uuidField(await readJson(req), 'form_id');
  await rpc('svc_form_banner_target', {
    p_actor: data.user.id,
    p_form_id: formId,
  });
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
  if (!cloudName || !apiKey || !apiSecret) {
    throw new HttpError(503, 'not_configured', 'Image uploads are not set up yet (Cloudinary secrets missing)');
  }
  if (cloudName !== EXPECTED_CLOUD) {
    throw new HttpError(503, 'not_configured', 'CLOUDINARY_CLOUD_NAME does not match the house account');
  }
  // Every signed parameter, sorted by name (Cloudinary's signature rule).
  const params: Record<string, string> = {
    allowed_formats: 'jpg,png,webp',
    folder: `sundarbans/forms/${formId}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    transformation: 'c_limit,w_1600',
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return {
    upload_url: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    cloud_name: cloudName,
    api_key: apiKey,
    ...params,
    signature: await sha1Hex(toSign + apiSecret),
  };
});
