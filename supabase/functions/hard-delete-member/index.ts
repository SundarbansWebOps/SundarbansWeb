// hard-delete-member (spec §10, §15, §16)
// POST { "request_id": uuid }   Caller: a Super Admin OTHER than the one who filed the request.
//
// Approves and executes a member_hard_delete request filed with request_hard_delete():
//   1. svc_execute_hard_delete (one DB transaction): checks the second-Super-Admin rule and the
//      30-day wait, anonymises the member (placeholders), clears form answers, redacts the
//      member's request snapshots, marks the request approved + executed, writes audit_log.
//   2. Deletes the Auth user (sessions and identities go with it).
//   3. Reconciles the member's Drive files within a time budget.
// Anonymise first, then delete (the member id, blacklist hashes, requests and audit stay).
// Calling again with the same request_id retries Auth deletion and drains more Drive work.
import { admin, HttpError, readJson, requireSuperAdmin, rpc, serve, uuidField } from "../_shared/common.ts";
import { sweepFormFiles } from "../_shared/drive.ts";
serve("hard-delete-member", async (req)=>{
  const actor = await requireSuperAdmin(req);
  const requestId = uuidField(await readJson(req), "request_id");
  const result = await rpc("svc_execute_hard_delete", {
    p_actor: actor,
    p_request_id: requestId
  });
  const { error } = await admin.auth.admin.deleteUser(result.member_id);
  const alreadyGone = error && (error.status === 404 || /not found/i.test(error.message));
  if (error && !alreadyGone) {
    await rpc("svc_record_auth_action", {
      p_actor: actor,
      p_member_id: result.member_id,
      p_action: "auth.delete_user",
      p_details: {
        request_id: requestId,
        error: error.message
      },
      p_result: "failure"
    });
    throw new HttpError(502, "auth_error", "Member was anonymised, but deleting the Auth user failed; call again with the same request_id to retry");
  }
  if (!alreadyGone) {
    await rpc("svc_record_auth_action", {
      p_actor: actor,
      p_member_id: result.member_id,
      p_action: "auth.delete_user",
      p_details: {
        request_id: requestId
      }
    });
  }
  const deadline = Date.now() + 20_000;
  let formFilesDeleted = 0;
  while (Date.now() < deadline) {
    const batch = await sweepFormFiles(10, { memberId: result.member_id, deadline });
    formFilesDeleted += batch.deleted;
    if (!batch.claimed) break;
  }
  const formFilesRemaining = await rpc("svc_form_files_remaining", {
    p_member_id: result.member_id
  });
  return {
    request_id: requestId,
    member_id: result.member_id,
    state: result.state,
    auth_user_deleted: true,
    form_files_deleted: formFilesDeleted,
    form_files_remaining: formFilesRemaining
  };
});
