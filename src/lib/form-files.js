// Member file uploads for form questions (Spec 008) and the form banner.
//
// Files go to the house's private Google Drive through the `form-file` Edge Function: `start`
// creates a Drive upload session bound to a database row, the browser PUTs the bytes straight to
// Drive, and `finish` has the server re-check the result. Only people who manage the form can open
// a file (`view`). The banner uses the same signed Cloudinary upload as event posters.
import { supabase, SUPABASE_URL } from './supabase.js';

export const FILE_LIMITS = {
  maxFiles: 10,
  pdfBytes: 10 * 1024 * 1024,
  imageSourceBytes: 25 * 1024 * 1024,
  imageOutBytes: 5 * 1024 * 1024,
  imageMaxPx: 2000,
};

export function acceptFor(kind) {
  if (kind === 'image') return 'image/*';
  if (kind === 'pdf') return 'application/pdf';
  return 'image/*,application/pdf';
}

const mb = (n) => `${Math.round(n / 1024 / 1024)} MB`;

async function startsWithPdfHeader(blob) {
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === '%PDF-';
}

function encodeCanvas(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Image -> WebP (JPEG where WebP encoding is unsupported), longest side <= imageMaxPx. Decoding via
// createImageBitmap applies EXIF orientation, and re-encoding drops EXIF/GPS metadata.
async function compressImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error("This photo format can't be read here — please share it as JPEG or PNG.");
  }
  try {
    const scale = Math.min(1, FILE_LIMITS.imageMaxPx / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    let blob = await encodeCanvas(canvas, 'image/webp', 0.82);
    // Browsers without WebP encoding silently return a PNG.
    if (!blob || blob.type !== 'image/webp') blob = await encodeCanvas(canvas, 'image/jpeg', 0.85);
    if (!blob)
      throw new Error("This photo format can't be read here — please share it as JPEG or PNG.");
    if (blob.size > FILE_LIMITS.imageOutBytes)
      throw new Error(
        `That photo is still larger than ${mb(FILE_LIMITS.imageOutBytes)} after compression.`
      );
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const base = (file.name || 'photo').replace(/\.[^.]*$/, '') || 'photo';
    return { blob, name: `${base}.${ext}`, mime: blob.type, size: blob.size };
  } finally {
    bitmap.close?.();
  }
}

// kind: the field's `accept` ('image' | 'pdf' | 'any'). Throws Error with a message for the member.
export async function prepareFile(file, kind) {
  if (!file) throw new Error('Choose a file.');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  const isImage = !isPdf && (file.type || '').startsWith('image/');
  if (!isPdf && !isImage) throw new Error('Choose a photo or a PDF.');
  if (isPdf && kind === 'image') throw new Error('This question takes photos only.');
  if (isImage && kind === 'pdf') throw new Error('This question takes a PDF only.');
  if (isPdf) {
    if (file.size > FILE_LIMITS.pdfBytes)
      throw new Error(`The PDF is larger than ${mb(FILE_LIMITS.pdfBytes)}.`);
    if (!(await startsWithPdfHeader(file))) throw new Error('That file is not a valid PDF.');
    return {
      blob: file,
      name: file.name || 'document.pdf',
      mime: 'application/pdf',
      size: file.size,
    };
  }
  if (file.size > FILE_LIMITS.imageSourceBytes)
    throw new Error(`The photo is larger than ${mb(FILE_LIMITS.imageSourceBytes)}.`);
  return compressImage(file);
}

// Calls a form-file/sign-* function and returns the parsed JSON; throws Error(server message).
async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error?.name === 'FunctionsFetchError')
    throw new Error('Could not reach the server. Check your connection and try again.');
  if (error) {
    let message = error.message;
    try {
      const out = await error.context?.json();
      message = out?.message ?? out?.error ?? message;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
  return data;
}

// XHR (not fetch) for upload progress. Resolves with Drive's JSON reply.
function putToDrive(url, blob, mime, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const aborted = () => Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' });
    if (signal?.aborted) return reject(aborted());
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let out = null;
      try {
        out = JSON.parse(xhr.responseText);
      } catch {
        /* handled below */
      }
      if (xhr.status >= 200 && xhr.status < 300 && out?.id) resolve(out);
      else reject(new Error('The upload did not complete. Please try again.'));
    };
    xhr.onerror = () =>
      reject(new Error('The upload was interrupted. Check your connection and try again.'));
    xhr.onabort = () => reject(aborted());
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

// prepared: the result of prepareFile. Resolves { file_id, name, mime, size }; after any failure
// past `start` the half-made upload is removed (best effort).
export async function uploadFormFile({ formId, fieldKey, prepared, onProgress, signal }) {
  const started = await invoke('form-file', {
    action: 'start',
    form_id: formId,
    field_key: fieldKey,
    name: prepared.name,
    mime: prepared.mime,
    size: prepared.size,
  });
  try {
    const drive = await putToDrive(
      started.upload_url,
      prepared.blob,
      prepared.mime,
      onProgress,
      signal
    );
    return await invoke('form-file', {
      action: 'finish',
      file_id: started.file_id,
      drive_file_id: drive.id,
    });
  } catch (e) {
    await removeFormFile(started.file_id).catch(() => {});
    throw e;
  }
}

export async function removeFormFile(fileId) {
  await invoke('form-file', { action: 'remove', file_id: fileId });
}

// Manager-only. The function streams the file after its access check; we need the raw bytes, so
// this calls it with fetch rather than the JSON-oriented functions client.
export async function fetchFormFileBlob(fileId) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sign in again to open this file.');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (supabase.supabaseKey) headers.apikey = supabase.supabaseKey;
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/form-file`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'view', file_id: fileId }),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  if (!res.ok) {
    const out = await res.json().catch(() => ({}));
    throw new Error(out?.message ?? "Couldn't load file");
  }
  return res.blob();
}

// Signed Cloudinary upload params for the form's banner (the form must be saved first).
export const signFormBanner = (formId) => invoke('sign-form-banner', { form_id: formId });

export const BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const BANNER_MAX_BYTES = 10 * 1024 * 1024;
const BANNER_DELIVERY = 'f_auto,q_auto:good,w_1600,c_limit';

// Returns the banner's secure delivery URL (what lounge_forms.banner_url stores).
export async function uploadFormBanner(formId, file) {
  if (!formId) throw new Error('Save the form before adding a banner.');
  if (!BANNER_TYPES.includes(file?.type)) throw new Error('Use a JPG, PNG or WebP image.');
  if (file.size > BANNER_MAX_BYTES) throw new Error('The image is larger than 10 MB.');
  const sig = await signFormBanner(formId);
  const body = new FormData();
  body.append('file', file);
  for (const k of [
    'api_key',
    'timestamp',
    'signature',
    'folder',
    'allowed_formats',
    'transformation',
  ])
    body.append(k, sig[k]);
  const res = await fetch(sig.upload_url, { method: 'POST', body });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.error?.message || 'Cloudinary refused the image.');
  return `https://res.cloudinary.com/${sig.cloud_name}/image/upload/${BANNER_DELIVERY}/v${out.version}/${out.public_id}.${out.format}`;
}
