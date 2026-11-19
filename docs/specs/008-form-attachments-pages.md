# Spec 008 — Form attachments, banner, sections and pages

> Status: approved by Raja 2026-11-19. Goal: Lounge forms become "better Google Forms": members attach
> photos/PDFs, admins add a banner, section headers and Next/Back pages.

## Decisions (from Raja)

| # | Decision |
|---|---|
| D1 | New question type `file`: **members** attach files when answering. Admins do not attach files to the form itself (except the banner). |
| D2 | Member files live in the house **webadmin Google Drive**, private (never "anyone with link"). The database maps each Drive file to form, field, member and response. |
| D3 | Only people who manage the form (`private.manages_form`, which includes Super Admins) can open a file. The submitter sees the **filename only**. Files are streamed through an Edge Function after the access check; no Drive URL reaches a browser except the owner-only Drive folder link. |
| D4 | Per field the admin sets: allowed kinds (`image`, `pdf`, `any`) and max files (1–10). Hard caps: PDF ≤ 10 MB; photo source ≤ 25 MB, compressed in the browser to ≤ 2000 px WebP (JPEG fallback), output ≤ 5 MB. PDFs are not compressed. |
| D5 | **No editing** after submit (current one-response rule stays). Before submitting, a member may remove/replace a pending upload. |
| D6 | Deletion: abandoned uploads (never submitted) after 24 h; all of a member's files when the member is **hard-deleted**. Rejected responses and deleted forms keep their Drive files. |
| D7 | Banner image on top of the form, hosted on **Cloudinary** (same signed-upload pattern as event posters). |
| D8 | Layout items: **section header** (title + description, no input) and **page break** (Next/Back pages). **No conditional branching.** |
| D9 | Admin review: inline thumbnails / PDF open in the existing response review; CSV export holds an admin-gated site link per file (never a Drive link); Super Admins get an "Open Drive folder" link. Keep it simple for admins. |

## Field schema (lounge_forms.fields, jsonb array)

Existing types stay: `text, textarea, email, phone, select, checkbox, multiselect`. New:

```jsonc
{ "key": "payment_proof", "label": "Payment screenshot", "type": "file", "required": true,
  "accept": "image" | "pdf" | "any",      // required for type=file
  "max_files": 1 }                          // integer 1..10, required for type=file
{ "key": "s_about", "label": "About you", "type": "section", "description": "optional ≤ 2000 chars" }
{ "key": "p_2", "label": "Page 2 title (optional text)", "type": "page_break", "description": "optional" }
```

- `section` and `page_break` keep the key rules (unique, `^[a-z][a-z0-9_]{0,63}$`) but never take
  answers, cannot be `required`, and are ignored by submit validation and export columns. Label for
  `page_break` may be blank in the UI; the builder stores a default like `Page 2`.
- `description` (≤ 2000 chars, plain text, line breaks kept) is allowed on any field type.
- A form may not start with a `page_break`, may not end with one, and may not have two in a row.
- Field-level validation lives in the **latest** definition of the save path (grep all migrations for
  the newest `save_lounge_form` / field validator — later migrations such as `140_save_form_fields`
  redefined it). Extend that, do not resurrect an older body.

## Banner

- `lounge_forms.banner_url text null`, constraint like `events_image_cloudinary`:
  `^https://res\.cloudinary\.com/l59gy0g2/image/upload/` and length ≤ 2048. Saved through
  `save_lounge_form` (so publish-approval freezing and audit apply unchanged).
- Edge Function `sign-form-banner` (copy of `sign-event-image`): POST `{ form_id }`, checks
  `manages_form` via a `svc_` RPC, signs folder `sundarbans/forms/<form id>`, formats jpg/png/webp,
  `transformation c_limit,w_1600`. Banner upload is enabled only after the form has been saved once.
- Shown full-width above the title on FormPage and in the Lounge form card if one exists; decorative
  (`alt=""`) unless the admin adds alt text (`banner_alt`, ≤ 300 chars, optional).

## Member file uploads (Drive)

### Secrets (Edge Function)
`GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` (webadmin account,
scope `https://www.googleapis.com/auth/drive.file` only; OAuth app must be **Published** or Internal so
the refresh token doesn't expire after 7 days). Missing secrets → HTTP 503 `not_configured`; the UI shows
"File uploads aren't set up yet — contact the web team."

`_shared/drive.ts`: mint access token from refresh token (cache in module scope until 60 s before
expiry); helpers for create folder, create resumable session, get metadata, range-read first bytes,
stream media, delete. Map Drive `storageQuotaExceeded` → HTTP 507 `storage_full` ("House storage is
full — contact the web team"); Drive 401/invalid_grant → 503 `drive_auth`.

With `drive.file` the app sees only files it created, so the app creates its own folders:
root folder `Sundarbans Forms` (id stored in a private one-row table, created lazily), one subfolder per
form `<form title> · <first 8 chars of form id>` (id in `private.form_drive_folders(form_id, folder_id)`).

### Table `public.form_files`

```
id uuid pk, form_id uuid → lounge_forms (on delete cascade; Drive files are kept, D6),
field_key text, member_id uuid → members, response_id uuid null → form_responses,
original_name text (≤ 200, sanitised), mime text check in ('image/webp','image/jpeg','image/png','application/pdf'),
size_bytes int (1..10485760), drive_file_id text null unique,
status text check in ('uploading','ready','attached','delete_pending'),
created_at, attached_at
```
RLS on. Members/managers do not read this table directly; access is through RPCs/functions. No
direct grants to `authenticated` beyond what RPCs need (follow existing hardening patterns).

### Edge Function `form-file` (one function, POST JSON with `action`)

All actions require a valid bearer token; the DB decides via `svc_*` RPCs (pattern of
`sign-event-image` / `svc_event_image_target`).

1. `start { form_id, field_key, name, mime, size }` → RPC checks: active member, `can_submit_form`,
   member has **no** response for this form yet, field exists with `type=file`, `mime` allowed by the
   field's `accept`, `size` within cap, (uploading+ready) files for member/field < `max_files`, and
   starts for member/field in the last 7 days < `3 × max_files + 5` (discarded files still count, since
   Drive keeps a resumable URL alive for up to a week).
   Inserts row `uploading`. Function ensures the form folder, then creates a Drive **resumable upload
   session** with metadata `{ name: "<email local part> – <field label> – <n>.<ext>", parents:[folder],
   appProperties:{ form_file_id: <row id> } }`, `X-Upload-Content-Type`/`-Length` = declared, and the
   caller's (allowed) `Origin` header so the browser can PUT cross-origin. Returns
   `{ file_id, upload_url }`. Opportunistically sweeps (see Cleanup).
2. Browser PUTs the bytes to `upload_url` (XHR for progress). Drive replies with `{ id }`.
3. `finish { file_id, drive_file_id }` → function GETs Drive metadata for `drive_file_id` and requires:
   `appProperties.form_file_id == file_id`, parent == form folder, `size` == declared size,
   `mimeType` == declared mime; then range-reads the first 16 bytes and checks magic bytes
   (`%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`). On any mismatch it deletes the
   Drive file and the row and returns 422. On success RPC marks the row `ready` with `drive_file_id`.
4. `remove { file_id }` → own row, not `attached` → delete Drive file (ignore 404) and row.
5. `view { file_id }` → RPC requires `manages_form(form_id)` and status `attached`; streams Drive
   media with the stored `Content-Type`, `Content-Disposition: inline; filename*=...`,
   `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=300`,
   `Content-Security-Policy: sandbox`. The client fetches it with the bearer token and shows a blob URL.

### Submit

`submit_lounge_form` (extend the **latest** definition) for each `file` field: answer is an array of
`form_files.id` strings (≤ `max_files`; required ⇒ ≥ 1). Every id must belong to this member, form and
field with status `ready`, else 22023. It marks them `attached` + `response_id`, and stores the answer as
`[{ "file_id": "...", "name": "original.jpg", "mime": "...", "size": n }]`. `section`/`page_break` keys are
rejected if present in answers (or stripped) and never required. Keep all existing locking/recheck logic.

### Cleanup (no cron; pg_net stays uninstalled by design)

- `svc_form_files_sweep(limit)` returns up to `limit` rows that are (`uploading`/`ready` and older than
  24 h) or `delete_pending`; the function deletes them from Drive (404 = done) and then deletes the rows
  via RPC. `form-file start` runs a sweep of ≤ 10 after its main work (errors logged, never fail the
  request). Abandoned files can therefore linger until the next upload anywhere; they are private.
- Hard delete: `svc_execute_hard_delete` (latest definition) marks the member's `form_files`
  `delete_pending` and clears `drive_file_id` only after deletion; `hard-delete-member` then deletes
  that member's Drive files (best effort, failures stay `delete_pending` for the sweep) and reports a
  count. Anonymisation stays one transaction as today.

## Admin review & export

- Response review (existing screen): file answers render as a row of thumbnails (images, lazy-loaded
  via `view`, object URLs revoked on unmount) and a PDF chip that opens the PDF in a new tab (blob URL).
  Click an image → larger view. Errors show inline ("Couldn't load file").
- Route `#/admin/files/:fileId` (signed-in admin): loads the file via `view` and shows it full-size or
  embeds the PDF; used by CSV links.
- CSV export: file columns contain `<site origin>/#/admin/files/<file id>` links (space separated).
- Super Admins see "Open Drive folder" (`https://drive.google.com/drive/folders/<folder id>`) on a form
  that has files. Opening it only works for the webadmin Google account; that's by design.

## Member experience (FormPage)

- Banner, title, description; then fields grouped into pages by `page_break`. Header shows
  "Page n of m" when m > 1. **Next** validates required fields on the current page (client-side, server
  still validates everything); **Back** keeps answers. Submit lives on the last page.
- Section headers render as a heading + description between questions.
- File field: drop zone / "Choose files" button, `accept` from field kind
  (`image/*`, `application/pdf`), shows per-file progress, compressed size, a remove button, and the
  count `1 of 3`. Images: decode with `createImageBitmap` (EXIF orientation applied), draw to canvas ≤
  2000 px longest side, encode `image/webp` q≈0.82, fall back to `image/jpeg` if WebP encoding is
  unsupported. Re-encoding strips EXIF/GPS. If decoding fails (e.g. HEIC on non-Safari browsers):
  "This photo format can't be read here — please share it as JPEG or PNG." PDFs: check size ≤ 10 MB and
  `%PDF-` header client-side before upload.
- Next/Submit are disabled while any upload is in progress. Errors from `start/finish` are shown per
  file with the server message.
- After submit (and on revisit), file answers show the filenames only.

## Admin builder (AdminForms)

- Add-question menu gains **File upload**, **Section header**, **Page break**.
- File field config: allowed kinds (Photos / PDF / Photos or PDF), max files (1–10), required.
- Any field: optional description.
- Banner: upload (after first save), preview, remove, alt text.
- Builder shows page grouping visually (a divider for page breaks) and blocks saving invalid
  page-break placement with a clear message.
- Super Admin: "Open Drive folder" when present.

## Client library contract (`src/lib/form-files.js`)

```js
export const FILE_LIMITS = { maxFiles: 10, pdfBytes: 10 * 1024 * 1024, imageSourceBytes: 25 * 1024 * 1024, imageOutBytes: 5 * 1024 * 1024, imageMaxPx: 2000 };
export function acceptFor(kind) // 'image' | 'pdf' | 'any' → input accept string
export async function prepareFile(file, kind) // → { blob, name, mime, size } (compressed image or checked PDF); throws Error(user message)
export async function uploadFormFile({ formId, fieldKey, prepared, onProgress, signal }) // → { file_id, name, mime, size }
export async function removeFormFile(fileId)
export async function fetchFormFileBlob(fileId) // → Blob (manager only)
export async function signFormBanner(formId) // → signed Cloudinary params, like the event poster helper
export async function uploadFormBanner(formId, file) // → secure_url
```

## Out of scope

Conditional branching, editing submitted responses, ZIP download, file versioning, virus scanning,
member access to their own file contents.

## Rollout (Raja / web team)

1. Google Cloud: OAuth client (web), scope `drive.file`, app **Published** (or Internal). Obtain a
   refresh token for the webadmin account (OAuth playground with own client credentials).
2. `supabase secrets set GOOGLE_DRIVE_CLIENT_ID=… GOOGLE_DRIVE_CLIENT_SECRET=… GOOGLE_DRIVE_REFRESH_TOKEN=…`
3. Apply the migration, deploy `form-file`, `sign-form-banner`, `hard-delete-member`.
