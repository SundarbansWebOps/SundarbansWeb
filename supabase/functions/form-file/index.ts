// form-file
// POST JSON { "action": "start" | "finish" | "remove" | "view", ... }   Caller: signed-in member.
// The database decides every action (svc_form_file_* RPCs); this function only talks to Drive.
//
//   start  { form_id, field_key, name, mime, size } -> { file_id, upload_url }
//   finish { file_id, drive_file_id }               -> { file_id, name, mime, size }
//   remove { file_id }                              -> { ok: true }
//   view   { file_id }                              -> the file bytes (managers of the form only)
//
// Files live in the house Drive, private. The browser uploads straight to a Drive resumable session
// bound to the row (appProperties.form_file_id); finish re-checks everything against Drive itself.
// Secrets: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN.
import { admin, allowedOrigin, HttpError, readJson, rpc, serve, uuidField } from '../_shared/common.ts';
import {
  createFolder,
  createUploadSession,
  deleteFile,
  deleteForRow,
  getMeta,
  isDriveId,
  magicMatches,
  openMedia,
  readHead,
  requireDrive,
  sweepFormFiles,
} from '../_shared/drive.ts';

const ROOT_NAME = 'Sundarbans Forms';

async function caller(req: Request): Promise<string> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'unauthenticated', 'Missing bearer token');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'unauthenticated', 'Invalid or expired session');
  return data.user.id;
}

function text(body: Record<string, unknown>, name: string, max: number): string {
  const v = body[name];
  if (typeof v !== 'string' || v.length === 0 || v.length > max)
    throw new HttpError(400, 'invalid_input', `${name} must be a string of at most ${max} characters`);
  return v;
}

// Content-Disposition with an ASCII fallback and an RFC 5987 UTF-8 name.
function disposition(name: string): string {
  const ascii = name.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 150) || 'file';
  const utf8 = encodeURIComponent(name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

async function start(actor: string, body: Record<string, unknown>, req: Request) {
  const formId = uuidField(body, 'form_id');
  const fieldKey = text(body, 'field_key', 64);
  const name = text(body, 'name', 500);
  const mime = text(body, 'mime', 100);
  const size = body.size;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1)
    throw new HttpError(400, 'invalid_input', 'size must be a positive integer');
  requireDrive();
  const origin = allowedOrigin(req);
  if (!origin) throw new HttpError(403, 'forbidden', 'Uploads are only allowed from the Sundarbans site');

  const row = await rpc('svc_form_file_start', {
    p_actor: actor,
    p_form_id: formId,
    p_field_key: fieldKey,
    p_name: name,
    p_mime: mime,
    p_size: size,
  });
  try {
    let root: string | null = row.root_id;
    if (!root) {
      const made = await createFolder(ROOT_NAME);
      root = await rpc('svc_form_drive_root_set', { p_folder_id: made });
      if (root !== made) await deleteFile(made).catch(() => {});
    }
    let folder: string | null = row.folder_id;
    if (!folder) {
      const made = await createFolder(`${row.form_title} · ${formId.slice(0, 8)}`, root!);
      folder = await rpc('svc_form_drive_folder_set', { p_form_id: formId, p_folder_id: made });
      if (folder !== made) await deleteFile(made).catch(() => {});
    }
    const uploadUrl = await createUploadSession({
      name: row.drive_name,
      parent: folder!,
      fileId: row.file_id,
      mime,
      size,
      origin,
    });
    after(sweepFormFiles(10));
    return { file_id: row.file_id, upload_url: uploadUrl };
  } catch (e) {
    await rpc('svc_form_file_discard', { p_actor: actor, p_file_id: row.file_id })
      .then(() => rpc('svc_form_files_done', { p_ids: [row.file_id] }))
      .catch((err) => console.error('form-file start cleanup:', err));
    throw e;
  }
}

// Removes a row's Drive file and then the row. A Drive failure leaves it delete_pending (sweep).
async function discard(actor: string, fileId: string) {
  const row = await rpc('svc_form_file_discard', { p_actor: actor, p_file_id: fileId });
  try {
    await deleteForRow(fileId, row.drive_file_id);
    await rpc('svc_form_files_done', { p_ids: [fileId] });
  } catch (e) {
    console.error('form-file discard left for sweep:', fileId, e);
  }
}

async function finish(actor: string, body: Record<string, unknown>) {
  const fileId = uuidField(body, 'file_id');
  const driveId = body.drive_file_id;
  if (!isDriveId(driveId)) throw new HttpError(400, 'invalid_input', 'drive_file_id is not valid');
  requireDrive();
  const target = await rpc('svc_form_file_finish_target', { p_actor: actor, p_file_id: fileId });

  const fail = async (why: string): Promise<never> => {
    console.error('form-file finish rejected', fileId, why);
    // Delete only what is provably this row's: the claimed file if its appProperties say so, plus
    // anything Drive holds for this row id. Never a file the caller merely named.
    try {
      const meta = await getMeta(driveId);
      if (meta?.appProperties?.form_file_id === fileId) await deleteFile(driveId);
    } catch (e) {
      console.error('form-file finish cleanup (claimed file):', e);
    }
    await discard(actor, fileId).catch((e) => console.error('form-file finish cleanup (row):', e));
    throw new HttpError(422, 'verification_failed', 'That upload could not be verified. Please try again.');
  };

  if (target.status === 'ready' && target.drive_file_id === driveId) {
    return await rpc('svc_form_file_finish_ok', { p_actor: actor, p_file_id: fileId, p_drive_file_id: driveId });
  }
  if (!target.folder_id) return await fail('no folder');
  const meta = await getMeta(driveId);
  if (!meta) return await fail('not found');
  if (meta.appProperties?.form_file_id !== fileId) return await fail('row mismatch');
  if (meta.trashed) return await fail('trashed');
  if (!meta.parents || meta.parents.length !== 1 || meta.parents[0] !== target.folder_id) return await fail('parent');
  if (Number(meta.size) !== target.size_bytes) return await fail('size');
  if (meta.mimeType !== target.mime) return await fail('mime');
  if (!magicMatches(target.mime, await readHead(driveId))) return await fail('magic bytes');
  return await rpc('svc_form_file_finish_ok', { p_actor: actor, p_file_id: fileId, p_drive_file_id: driveId });
}

async function view(actor: string, body: Record<string, unknown>) {
  const fileId = uuidField(body, 'file_id');
  requireDrive();
  const target = await rpc('svc_form_file_view_target', { p_actor: actor, p_file_id: fileId });
  const media = await openMedia(target.drive_file_id);
  if (!media) throw new HttpError(404, 'not_found', 'File not found');
  const headers = new Headers({
    'Content-Type': target.mime,
    'Content-Disposition': disposition(String(target.name)),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, max-age=300',
    'Content-Security-Policy': 'sandbox',
  });
  const length = media.headers.get('Content-Length');
  if (length) headers.set('Content-Length', length);
  return new Response(media.body, { status: 200, headers });
}

// Run work after the response when the platform supports it; otherwise just start it.
function after(work: Promise<unknown>): void {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(work);
  else work.catch(() => {});
}

serve('form-file', async (req: Request) => {
  const actor = await caller(req);
  const body = await readJson(req);
  switch (body.action) {
    case 'start':
      return await start(actor, body, req);
    case 'finish':
      return await finish(actor, body);
    case 'remove':
      await discard(actor, uuidField(body, 'file_id'));
      return { ok: true };
    case 'view':
      return await view(actor, body);
    default:
      throw new HttpError(400, 'invalid_input', 'Unknown action');
  }
});
