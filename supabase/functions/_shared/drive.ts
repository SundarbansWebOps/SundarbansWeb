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

async function accessToken(force: boolean, signal?: AbortSignal): Promise<string> {
  requireDrive();
  if (!force && cached && cached.expires - 60_000 > Date.now()) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal,
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
  const signal = init.signal ?? undefined;
  for (let attempt = 0; ; attempt++) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${await accessToken(attempt > 0, signal)}`);
    const res = await fetch(url, { ...init, headers, signal });
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

// Drive supports pre-generated IDs for binary resumable uploads.
export async function generateFileId(): Promise<string> {
  const res = await drive(`${API}/files/generateIds?count=1&space=drive`);
  const { ids } = await res.json();
  if (!isDriveId(ids?.[0])) throw new HttpError(502, 'drive_error', 'File storage is not responding.');
  return ids[0];
}

// Resumable session for one file. `origin` is the caller's allowed Origin so the browser may PUT
// the bytes straight to Drive. Returns the session URL (the browser's upload target).
export async function createUploadSession(opts: {
  name: string;
  parent: string;
  fileId: string;
  driveId: string;
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
      id: opts.driveId,
      name: opts.name,
      mimeType: opts.mime,
      parents: [opts.parent],
      appProperties: { form_file_id: opts.fileId },
    }),
  });
  const location = res.headers.get('Location');
  await res.body?.cancel();
  if (!location || !location.startsWith(`${UPLOAD}/files?`)) {
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
export async function getMeta(driveId: string, signal?: AbortSignal): Promise<DriveMeta | null> {
  if (!isDriveId(driveId)) return null;
  const res = await drive(
    `${API}/files/${driveId}?fields=id,mimeType,size,parents,appProperties,trashed`,
    { signal },
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
export async function deleteFile(driveId: string, signal?: AbortSignal): Promise<void> {
  if (!isDriveId(driveId)) return;
  const res = await drive(`${API}/files/${driveId}`, { method: 'DELETE', signal }, [404]);
  await res.body?.cancel();
}

// Fallback for rows whose Drive ID was never recorded. Include trashed files as well.
async function findByRow(fileId: string, signal: AbortSignal): Promise<string[]> {
  if (!UUID.test(fileId)) return [];
  const q = `appProperties has { key='form_file_id' and value='${fileId}' }`;
  const ids: string[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ fields: 'nextPageToken,files(id)', q });
    if (pageToken) params.set('pageToken', pageToken);
    const { files, nextPageToken } = await (await drive(`${API}/files?${params}`, { signal })).json();
    ids.push(...(files ?? []).map((file: { id: string }) => file.id).filter(isDriveId));
    pageToken = nextPageToken;
  } while (pageToken);
  return ids;
}

type PendingFile = { id: string; drive_file_id: string | null; upload_session_url: string | null };

async function reconcile(row: PendingFile, signal: AbortSignal): Promise<boolean> {
  if (row.upload_session_url) {
    // Probe the tracked session itself. A missing file while a PUT is still possible
    // cannot prove that there are no bytes to erase.
    if (!row.upload_session_url.startsWith(`${UPLOAD}/files?`)) throw new Error('Invalid Drive session');
    const status = await drive(row.upload_session_url, {
      method: 'PUT',
      headers: { 'Content-Range': 'bytes */*' },
      body: new Uint8Array(0),
      redirect: 'manual',
      signal,
    }, [308, 404, 410]);
    await status.body?.cancel();
    if (status.status === 308) return false;
  }
  const ids = row.drive_file_id ? [row.drive_file_id] : await findByRow(row.id, signal);
  for (const driveId of ids) await deleteFile(driveId, signal);
  return true;
}

export async function sweepFormFiles(
  limit: number,
  { memberId = null, fileId = null, deadline = Date.now() + 10_000 }:
    { memberId?: string | null; fileId?: string | null; deadline?: number } = {},
): Promise<{ claimed: number; deleted: number }> {
  const empty = { claimed: 0, deleted: 0 };
  try {
    if (!driveConfigured() || Date.now() >= deadline) return empty;
    const rows = await rpc('svc_form_files_sweep', {
      p_limit: limit,
      p_member_id: memberId,
      p_file_id: fileId,
    }) as PendingFile[];
    const results = await Promise.all(rows.map(async (row) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return null;
      try {
        const signal = AbortSignal.timeout(Math.min(5_000, remaining));
        return await reconcile(row, signal) ? row.id : null;
      } catch (e) {
        console.error('sweep: Drive reconciliation failed for', row.id, e);
        return null;
      }
    }));
    const done = results.filter((id): id is string => id !== null);
    const deleted = done.length ? await rpc('svc_form_files_done', { p_ids: done }) : 0;
    return { claimed: rows.length, deleted };
  } catch (e) {
    console.error('sweep failed:', e);
    return empty;
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
