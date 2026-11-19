// Google Drive helpers for the form-file functions. The webadmin account's refresh token is read
// from the function environment only and never leaves it; callers see an access token only inside
// these helpers. Scope drive.file: the app can touch only files it created itself.
//
// Secrets: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN.
import { HttpError, rpc } from './common.ts';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ID = /^[A-Za-z0-9_-]{10,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isDriveId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

export function driveConfigured(): boolean {
  return Boolean(
    Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') &&
      Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') &&
      Deno.env.get('GOOGLE_DRIVE_REFRESH_TOKEN')
  );
}

export function requireDrive(): void {
  if (!driveConfigured()) {
    throw new HttpError(
      503,
      'not_configured',
      "File uploads aren't set up yet — contact the web team."
    );
  }
}

let cached: { token: string; expires: number } | null = null;

async function accessToken(force = false): Promise<string> {
  requireDrive();
  if (!force && cached && cached.expires - 60_000 > Date.now()) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('GOOGLE_DRIVE_REFRESH_TOKEN')!,
      grant_type: 'refresh_token',
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.access_token) {
    console.error('drive token refresh failed:', res.status, out?.error);
    throw new HttpError(
      503,
      'drive_auth',
      "File storage needs to be reconnected — contact the web team."
    );
  }
  cached = { token: out.access_token, expires: Date.now() + (Number(out.expires_in) || 3000) * 1000 };
  return cached.token;
}

// Authorised fetch with one retry on 401 (token revoked/expired early). Errors map to HttpError.
async function drive(url: string, init: RequestInit = {}, okStatuses: number[] = []): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${await accessToken(attempt > 0)}`);
    const res = await fetch(url, { ...init, headers });
    if (res.ok || okStatuses.includes(res.status)) return res;
    if (res.status === 401 && attempt === 0) {
      await res.body?.cancel();
      continue;
    }
    const text = await res.text().catch(() => '');
    let reason = '';
    try {
      reason = JSON.parse(text)?.error?.errors?.[0]?.reason ?? '';
    } catch {
      /* not JSON */
    }
    if (res.status === 401) {
      throw new HttpError(503, 'drive_auth', 'File storage needs to be reconnected — contact the web team.');
    }
    if (reason === 'storageQuotaExceeded') {
      throw new HttpError(507, 'storage_full', 'House storage is full — contact the web team.');
    }
    console.error('drive error:', res.status, reason, text.slice(0, 300));
    throw new HttpError(502, 'drive_error', 'File storage is not responding. Try again shortly.');
  }
}

export async function createFolder(name: string, parent?: string): Promise<string> {
  const res = await drive(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }),
  });
  const { id } = await res.json();
  if (!isDriveId(id)) throw new HttpError(502, 'drive_error', 'File storage is not responding.');
  return id;
}

// Resumable session for one file. `origin` is the caller's allowed Origin so the browser may PUT
// the bytes straight to Drive. Returns the session URL (the browser's upload target).
export async function createUploadSession(opts: {
  name: string;
  parent: string;
  fileId: string;
  mime: string;
  size: number;
  origin: string;
}): Promise<string> {
  const res = await drive(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': opts.mime,
      'X-Upload-Content-Length': String(opts.size),
      Origin: opts.origin,
    },
    body: JSON.stringify({
      name: opts.name,
      parents: [opts.parent],
      appProperties: { form_file_id: opts.fileId },
    }),
  });
  const location = res.headers.get('Location');
  await res.body?.cancel();
  if (!location || !location.startsWith('https://www.googleapis.com/')) {
    throw new HttpError(502, 'drive_error', 'File storage is not responding. Try again shortly.');
  }
  return location;
}

export type DriveMeta = {
  id: string;
  mimeType?: string;
  size?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  trashed?: boolean;
};

// null when the file does not exist (or is not ours: drive.file hides everything else).
export async function getMeta(driveId: string): Promise<DriveMeta | null> {
  if (!isDriveId(driveId)) return null;
  const res = await drive(
    `${API}/files/${driveId}?fields=id,mimeType,size,parents,appProperties,trashed`,
    {},
    [404]
  );
  if (res.status === 404) {
    await res.body?.cancel();
    return null;
  }
  return await res.json();
}

export async function readHead(driveId: string, bytes = 16): Promise<Uint8Array> {
  const res = await drive(`${API}/files/${driveId}?alt=media`, {
    headers: { Range: `bytes=0-${bytes - 1}` },
  });
  return new Uint8Array(await res.arrayBuffer()).slice(0, bytes);
}

// Streams media; null if gone.
export async function openMedia(driveId: string): Promise<Response | null> {
  if (!isDriveId(driveId)) return null;
  const res = await drive(`${API}/files/${driveId}?alt=media`, {}, [404]);
  if (res.status === 404) {
    await res.body?.cancel();
    return null;
  }
  return res;
}

// 404 counts as deleted.
export async function deleteFile(driveId: string): Promise<void> {
  if (!isDriveId(driveId)) return;
  const res = await drive(`${API}/files/${driveId}`, { method: 'DELETE' }, [404]);
  await res.body?.cancel();
}

// Drive files created for a row whose id we never recorded (upload finished, finish not called).
export async function findByRow(fileId: string): Promise<string[]> {
  if (!UUID.test(fileId)) return [];
  const q = `appProperties has { key='form_file_id' and value='${fileId}' }`;
  const res = await drive(`${API}/files?fields=files(id)&pageSize=10&q=${encodeURIComponent(q)}`);
  const { files } = await res.json();
  return (files ?? []).map((f: { id: string }) => f.id).filter(isDriveId);
}

// Deletes a row's Drive file(s): the recorded one, plus any session leftovers.
export async function deleteForRow(fileId: string, driveId: string | null): Promise<void> {
  const ids = new Set<string>(driveId ? [driveId] : []);
  if (!driveId) for (const id of await findByRow(fileId)) ids.add(id);
  for (const id of ids) await deleteFile(id);
}

// Claims up to `limit` abandoned/queued rows, deletes them from Drive, then drops the rows. A Drive
// failure leaves a row delete_pending for the next sweep. Never throws.
export async function sweepFormFiles(limit: number, memberId: string | null = null): Promise<number> {
  try {
    if (!driveConfigured()) return 0;
    const claimed = (await rpc('svc_form_files_sweep', {
      p_limit: limit,
      p_member_id: memberId,
    })) as { id: string; drive_file_id: string | null }[];
    const done: string[] = [];
    for (const row of claimed) {
      try {
        await deleteForRow(row.id, row.drive_file_id);
        done.push(row.id);
      } catch (e) {
        console.error('sweep: Drive delete failed for', row.id, e);
      }
    }
    if (done.length) await rpc('svc_form_files_done', { p_ids: done });
    return done.length;
  } catch (e) {
    console.error('sweep failed:', e);
    return 0;
  }
}

// First bytes -> does the content match the declared mime? (%PDF-, JPEG, PNG, WebP)
export function magicMatches(mime: string, b: Uint8Array): boolean {
  const at = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x);
  switch (mime) {
    case 'application/pdf':
      return at(0, 0x25, 0x50, 0x44, 0x46, 0x2d);
    case 'image/jpeg':
      return at(0, 0xff, 0xd8, 0xff);
    case 'image/png':
      return at(0, 0x89, 0x50, 0x4e, 0x47);
    case 'image/webp':
      return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50);
    default:
      return false;
  }
}
