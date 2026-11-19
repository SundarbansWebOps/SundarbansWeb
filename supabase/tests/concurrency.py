#!/usr/bin/env python3
"""Real lock-wait regression gates, using independent psql sessions and DB-observed blocking."""
import json
import os
import subprocess
import sys
import time
import uuid
from urllib.parse import urlparse

DB_URL = sys.argv[1] if len(sys.argv) == 2 else ''
parsed = urlparse(DB_URL)
if parsed.hostname not in ('127.0.0.1', 'localhost') or parsed.port != 54522:
    raise SystemExit('Pass the disposable local PostgreSQL URL on 54522; other hosts/ports are refused.')
PSQL = ['psql', DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']
RUN_ID = uuid.uuid4().hex[:12]
IDS = {key: str(uuid.uuid4()) for key in ['rc', 'member', 'import', 'release', 'region', 'suspension', 'publication', 'formscope']}
FORM_IDS = {key: str(uuid.uuid4()) for key in ['region', 'suspension', 'publication', 'formscope']}
ROSTER_EMAIL = f'race-roster-{RUN_ID}@ds.study.iitm.ac.in'
ROSTER_ADD_EMAIL = f'race-add-{RUN_ID}@ds.study.iitm.ac.in'


def sql(query):
    result = subprocess.run(PSQL + ['-c', query], text=True, capture_output=True, timeout=15)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def worker_query(uid, body):
    claims = json.dumps({'sub': uid, 'role': 'authenticated'})
    return f"BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='{claims}'; {body}; COMMIT;"


def race(name, blocking_mutation, worker_sql, unchanged_query, *, expected_state="42501", expected_output=None):
    blocker_name = f'lounge-blocker-{RUN_ID}-{name}'
    worker_name = f'lounge-worker-{RUN_ID}-{name}'
    blocker = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True,
                               env={**os.environ, 'PGAPPNAME': blocker_name})
    worker = None
    try:
        blocker.stdin.write(f"BEGIN; {blocking_mutation}; SELECT 'BLOCKER_READY';\n")
        blocker.stdin.flush()
        while blocker.stdout.readline().strip() != 'BLOCKER_READY':
            if blocker.poll() is not None:
                raise RuntimeError(blocker.stderr.read())
        worker = subprocess.Popen(PSQL + ['-c', worker_sql], text=True,
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                  env={**os.environ, 'PGAPPNAME': worker_name})
        deadline = time.monotonic() + 10
        blocked = False
        while time.monotonic() < deadline:
            # Assert actual PostgreSQL blocking, rather than assuming a sleep caused a race.
            blocked = sql(f"""SELECT EXISTS(SELECT 1 FROM pg_stat_activity w
                WHERE w.application_name='{worker_name}' AND w.wait_event_type='Lock'
                AND EXISTS(SELECT 1 FROM pg_stat_activity b
                    WHERE b.pid=ANY(pg_blocking_pids(w.pid))
                    AND b.application_name='{blocker_name}'))""") == 't'
            if blocked:
                break
            if worker.poll() is not None:
                raise AssertionError(f'{name}: worker completed before the intended lock wait')
            time.sleep(0.05)
        if not blocked:
            raise AssertionError(f'{name}: PostgreSQL did not report the expected blocking session')
        blocker.stdin.write("COMMIT; SELECT 'BLOCKER_COMMITTED';\n")
        blocker.stdin.flush()
        while blocker.stdout.readline().strip() != 'BLOCKER_COMMITTED':
            if blocker.poll() is not None:
                raise RuntimeError(blocker.stderr.read())
        stdout, stderr = worker.communicate(timeout=15)
        if expected_output is not None:
            if worker.returncode or stdout.strip() != expected_output:
                raise AssertionError(f'{name}: unexpected RPC result: {stdout} {stderr}')
        elif worker.returncode == 0 or expected_state not in stderr:
            raise AssertionError(f'{name}: wrong SQLSTATE: {stdout} {stderr}')
        if sql(unchanged_query) != 't':
            raise AssertionError(f'{name}: rejected operation still changed protected records')
        print(f'PASS {name}: pg_blocking_pids confirmed lock wait and the post-commit state was checked', flush=True)
    finally:
        if worker is not None and worker.poll() is None:
            worker.terminate()
            worker.communicate(timeout=10)
        if blocker.poll() is None:
            blocker.stdin.write('ROLLBACK;\n\\q\n')
            blocker.stdin.flush()
        blocker.communicate(timeout=10)


def setup():
    r1 = int(sql("SELECT id FROM public.regions WHERE code='region_01'"))
    r2 = int(sql("SELECT id FROM public.regions WHERE code='region_02'"))
    sql(f"""INSERT INTO public.members(id,member_code,email,region_id,cohort) VALUES
        ('{IDS['rc']}','SB{int(RUN_ID[:8],16):012d}','race-rc-{RUN_ID}@ds.study.iitm.ac.in',{r1},'26F3'),
        ('{IDS['member']}','SB{int(RUN_ID[:8],16)+1:012d}','race-member-{RUN_ID}@ds.study.iitm.ac.in',{r1},'26F3');
        INSERT INTO public.admin_assignments(member_id,position,region_id,assigned_by)
        VALUES('{IDS['rc']}','rc',{r1},'{IDS['rc']}');""")
    for key in ['import', 'release', 'region', 'suspension', 'publication', 'formscope']:
        # A signed template must be this event's uploaded object on a Supabase project host.
        sql(f"""INSERT INTO storage.objects(bucket_id,name) VALUES('certificate-templates','{IDS[key]}/signed.png');
            INSERT INTO public.events(id,name,region_id,starts_at,ends_at,published_at,
            certificate_template_url,created_by,updated_by) VALUES('{IDS[key]}','Race {RUN_ID} {key}',
            {r1},now()+interval '1 hour',now()+interval '1 day',now(),
            'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/certificate-templates/{IDS[key]}/signed.png',
            '{IDS['rc']}','{IDS['rc']}')""")
    for key, fid in FORM_IDS.items():
        sql(f"INSERT INTO public.lounge_forms(id,title,event_id,published_at,created_by) VALUES('{fid}','Race {key}','{IDS[key]}',now(),'{IDS['rc']}')")
    return r1, r2


def cleanup():
    event_ids = ','.join(f"'{IDS[k]}'" for k in ['import', 'release', 'region', 'suspension', 'publication', 'formscope'])
    form_ids = ','.join(f"'{fid}'" for fid in FORM_IDS.values())
    member_ids = f"'{IDS['rc']}','{IDS['member']}'"
    sql(f"""DELETE FROM public.issued_certificates WHERE event_id IN({event_ids});
        DELETE FROM public.event_attendance WHERE event_id IN({event_ids});
        DELETE FROM public.event_registrations WHERE event_id IN({event_ids});
        DELETE FROM public.form_responses WHERE form_id IN({form_ids});
        DELETE FROM public.lounge_forms WHERE id IN({form_ids});
        DELETE FROM public.member_roster WHERE email='{ROSTER_EMAIL}';
        DELETE FROM public.member_roster WHERE email='{ROSTER_ADD_EMAIL}';
        DELETE FROM public.events WHERE id IN({event_ids});
        DELETE FROM public.admin_assignments WHERE member_id IN({member_ids});
        DELETE FROM public.members WHERE id IN({member_ids});""")


def race_roster_region_change(r1, r2):
    sql(f"INSERT INTO public.member_roster(email,region_id,added_by) VALUES('{ROSTER_EMAIL}',{r1},'{IDS['rc']}')")
    blocker_name = f'lounge-blocker-{RUN_ID}-roster'
    worker_name = f'lounge-worker-{RUN_ID}-roster'
    blocker = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True,
                               env={**os.environ, 'PGAPPNAME': blocker_name})
    worker = None
    try:
        blocker.stdin.write(f"BEGIN; UPDATE public.member_roster SET region_id={r2} WHERE email='{ROSTER_EMAIL}'; SELECT 'BLOCKER_READY';\n")
        blocker.stdin.flush()
        while blocker.stdout.readline().strip() != 'BLOCKER_READY':
            if blocker.poll() is not None:
                raise RuntimeError(blocker.stderr.read())
        call = worker_query(IDS['rc'], f"SELECT public.roster_add_many('[{{\"email\":\"{ROSTER_EMAIL}\",\"region_id\":{r1}}}]')")
        worker = subprocess.Popen(PSQL + ['-c', call], text=True, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, env={**os.environ, 'PGAPPNAME': worker_name})
        deadline = time.monotonic() + 10
        blocked = False
        while time.monotonic() < deadline:
            blocked = sql(f"""SELECT EXISTS(SELECT 1 FROM pg_stat_activity w
                WHERE w.application_name='{worker_name}' AND w.wait_event_type='Lock'
                AND EXISTS(SELECT 1 FROM pg_stat_activity b WHERE b.pid=ANY(pg_blocking_pids(w.pid))
                  AND b.application_name='{blocker_name}'))""") == 't'
            if blocked:
                break
            if worker.poll() is not None:
                raise AssertionError('roster-import-region-change: worker completed before the intended row-lock wait')
            time.sleep(0.05)
        if not blocked:
            raise AssertionError('roster-import-region-change: PostgreSQL did not report the expected blocking session')
        blocker.stdin.write("COMMIT; SELECT 'BLOCKER_COMMITTED';\n")
        blocker.stdin.flush()
        while blocker.stdout.readline().strip() != 'BLOCKER_COMMITTED':
            if blocker.poll() is not None:
                raise RuntimeError(blocker.stderr.read())
        stdout, stderr = worker.communicate(timeout=15)
        if worker.returncode != 0:
            raise AssertionError(f'roster-import-region-change: RPC failed rather than returning an opaque row result: {stderr}')
        result = json.loads(stdout)
        if result[0].get('ok') is not True or result[0].get('category') != 'processed':
            raise AssertionError(f'roster-import-region-change: stale RC scope accepted or leaked conflict detail: {result}')
        if sql(f"SELECT region_id={r2} FROM public.member_roster WHERE email='{ROSTER_EMAIL}'") != 't':
            raise AssertionError('roster-import-region-change: row scope changed after rejection')
        print('PASS roster-import-region-change: pg_blocking_pids confirmed row-lock wait; stale RC import returned opaque failure; region preserved', flush=True)
    finally:
        if worker is not None and worker.poll() is None:
            worker.terminate()
            worker.communicate(timeout=10)
        if blocker.poll() is None:
            blocker.stdin.write('ROLLBACK;\n\\q\n')
            blocker.stdin.flush()
        blocker.communicate(timeout=10)


def race_duplicate_roster_add(r1):
    blocker_name = f'lounge-blocker-{RUN_ID}-roster-add'
    worker_names = [f'lounge-worker-{RUN_ID}-roster-add-{i}' for i in (1, 2)]
    blocker = subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True,
                               env={**os.environ, 'PGAPPNAME': blocker_name})
    workers = []
    try:
        blocker.stdin.write(f"BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('roster:{ROSTER_ADD_EMAIL}',0)); SELECT 'BLOCKER_READY';\n")
        blocker.stdin.flush()
        while blocker.stdout.readline().strip() != 'BLOCKER_READY':
            if blocker.poll() is not None:
                raise RuntimeError(blocker.stderr.read())
        for i, worker_name in enumerate(worker_names):
            call = worker_query(IDS['rc'], f"SELECT public.roster_add_many('[{{\"email\":\"{ROSTER_ADD_EMAIL}\",\"region_id\":{r1}}}]')")
            workers.append(subprocess.Popen(PSQL + ['-c', call], text=True,
                                            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                            env={**os.environ, 'PGAPPNAME': worker_name}))
        deadline = time.monotonic() + 10
        blocked_names = set()
        while time.monotonic() < deadline and len(blocked_names) != len(worker_names):
            for worker_name in worker_names:
                blocked = sql(f"""SELECT EXISTS(SELECT 1 FROM pg_stat_activity w
                    WHERE w.application_name='{worker_name}' AND w.wait_event_type='Lock'
                    AND EXISTS(SELECT 1 FROM pg_stat_activity b WHERE b.pid=ANY(pg_blocking_pids(w.pid))
                      AND b.application_name='{blocker_name}'))""") == 't'
                if blocked:
                    blocked_names.add(worker_name)
            if any(w.poll() is not None for w in workers):
                raise AssertionError('roster-add-same-email: an insert completed before the intended lock wait')
            time.sleep(0.05)
        if len(blocked_names) != len(worker_names):
            raise AssertionError('roster-add-same-email: both inserts did not wait on the canonical identity lock')
        blocker.stdin.write("COMMIT; SELECT 'BLOCKER_COMMITTED';\n")
        blocker.stdin.flush()
        while blocker.stdout.readline().strip() != 'BLOCKER_COMMITTED':
            if blocker.poll() is not None:
                raise RuntimeError(blocker.stderr.read())
        results = []
        for worker in workers:
            stdout, stderr = worker.communicate(timeout=15)
            if worker.returncode != 0:
                raise AssertionError(f'roster-add-same-email: RPC failed: {stderr}')
            results.append(json.loads(stdout)[0])
        if not all(row.get('category') == 'processed' and row.get('ok') is True for row in results):
            raise AssertionError(f'roster-add-same-email: concurrent result categories are wrong: {results}')
        if sql(f"SELECT count(*) FROM public.member_roster WHERE email='{ROSTER_ADD_EMAIL}'") != '1':
            raise AssertionError('roster-add-same-email: concurrent requests created other than one roster record')
        print('PASS roster-add-same-email: both requests blocked on canonical identity lock; one stored row and opaque RC results', flush=True)
    finally:
        for worker in workers:
            if worker.poll() is None:
                worker.terminate()
                worker.communicate(timeout=10)
        if blocker.poll() is None:
            blocker.stdin.write('ROLLBACK;\n\\q\n')
            blocker.stdin.flush()
        blocker.communicate(timeout=10)


def race_form_attachments(region):
    member = IDS['member']
    form = str(uuid.uuid4())
    file_id = str(uuid.uuid4())
    schema = json.dumps([
        {'key': key, 'label': key, 'type': 'file', 'accept': 'image', 'max_files': 10}
        for key in ('proof', 'extra', 'a', 'b', 'c', 'd', 'e')
    ])
    def start(field):
        return f"SELECT public.svc_form_file_start('{member}','{form}','{field}','proof.png','image/png',10)"

    def svc(query):
        return f"BEGIN; SET LOCAL ROLE service_role; {query}; COMMIT;"

    try:
        sql(f"""INSERT INTO public.lounge_forms(id,title,region_id,published_at,created_by,fields)
          VALUES('{form}','Attachment race',{region},now(),'{IDS['rc']}','{schema}')""")
        empty = f"SELECT NOT EXISTS(SELECT 1 FROM public.form_files WHERE form_id='{form}')"
        race('upload-form-close', f"UPDATE public.lounge_forms SET is_open=false WHERE id='{form}'",
             svc(start('proof')), empty)
        sql(f"UPDATE public.lounge_forms SET is_open=true WHERE id='{form}'")

        # Leave one member-wide slot. Both fields independently have their full allowance.
        sql(f"""INSERT INTO public.form_files(form_id,field_key,member_id,original_name,mime,size_bytes)
          SELECT '{form}', key, '{member}', 'quota.png', 'image/png', 10
          FROM unnest(array['a','b','c','d','e']) AS key CROSS JOIN generate_series(1,10) n
          WHERE key <> 'e' OR n < 10""")
        race('upload-member-cap', f"SET LOCAL ROLE service_role; {start('proof')}",
             svc(start('extra')),
             f"SELECT count(*)=50 FROM public.form_files WHERE form_id='{form}'",
             expected_state='22023')
        sql(f"DELETE FROM public.form_files WHERE form_id='{form}'")

        sql(f"""INSERT INTO public.form_files(id,form_id,field_key,member_id,original_name,mime,size_bytes)
            VALUES('{file_id}','{form}','proof','{member}','race.png','image/png',10)""")
        finish = f"SELECT public.svc_form_file_finish_ok('{member}','{file_id}','RACEFILE{RUN_ID}')"
        cancel = f"SELECT public.svc_form_file_discard('{member}','{file_id}',true)"
        # Model a late PUT completion: cancellation wins before finish can publish the bytes.
        race('cancel-before-upload-finish', f"SET LOCAL ROLE service_role; {cancel}", svc(finish),
             f"SELECT status='delete_pending' FROM public.form_files WHERE id='{file_id}'",
             expected_state='PT409')
        sql(f"UPDATE public.form_files SET status='uploading' WHERE id='{file_id}'")

        # A failed verifier wakes after the successful verifier commits, and cannot claim deletion.
        race('finish-before-stale-verifier', f"SET LOCAL ROLE service_role; {finish}", svc(cancel),
             f"SELECT status='ready' AND drive_file_id='RACEFILE{RUN_ID}' FROM public.form_files WHERE id='{file_id}'",
             expected_output='f')
        answer = json.dumps({'proof': [file_id]})
        claims = json.dumps({'sub': member, 'role': 'authenticated'})
        submit = f"SELECT public.submit_lounge_form('{form}','{answer}')"
        race('submit-before-upload-start', f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='{claims}'; {submit}",
             svc(start('extra')), f"SELECT status='attached' FROM public.form_files WHERE id='{file_id}'",
             expected_state='PT409')
    finally:
        sql(f"""DELETE FROM public.form_files WHERE form_id='{form}';
            DELETE FROM public.form_responses WHERE form_id='{form}';
            DELETE FROM public.lounge_forms WHERE id='{form}';""")


try:
    # pgTAP fixtures roll back; independent sessions need their own test-only pepper.
    sql("SELECT vault.create_secret(repeat('local-concurrency-only-',3),'blacklist_hash_pepper') WHERE NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='blacklist_hash_pepper')")
    r1, r2 = setup()
    race_roster_region_change(r1, r2)
    race_duplicate_roster_add(r1)
    race_form_attachments(r1)
    race('attendance-scope-change', f"UPDATE public.events SET region_id={r2} WHERE id='{IDS['import']}'",
         worker_query(IDS['rc'], f"SELECT public.import_event_attendance('{IDS['import']}', '[{{\"email\":\"race-member-{RUN_ID}@ds.study.iitm.ac.in\",\"duration_seconds\":1200}}]')"),
         f"SELECT NOT EXISTS(SELECT 1 FROM public.event_attendance WHERE event_id='{IDS['import']}')")
    race('release-scope-change', f"UPDATE public.events SET region_id={r2} WHERE id='{IDS['release']}'",
         worker_query(IDS['rc'], f"SELECT public.release_event_certificates('{IDS['release']}')"),
         f"SELECT certificates_released_at IS NULL FROM public.events WHERE id='{IDS['release']}'")
    race('form-save-event-scope-change', f"UPDATE public.events SET region_id={r2} WHERE id='{IDS['formscope']}'",
         worker_query(IDS['rc'], f"SELECT public.save_lounge_form('{{\"id\":\"{FORM_IDS['formscope']}\",\"title\":\"Denied stale organizer\",\"event_id\":\"{IDS['formscope']}\"}}')"),
         f"SELECT title='Race formscope' FROM public.lounge_forms WHERE id='{FORM_IDS['formscope']}'")
    race('registration-region-change', f"UPDATE public.members SET region_id={r2} WHERE id='{IDS['member']}'",
         worker_query(IDS['member'], f"SELECT public.submit_lounge_form('{FORM_IDS['region']}', '{{}}')"),
         f"SELECT NOT EXISTS(SELECT 1 FROM public.form_responses WHERE form_id='{FORM_IDS['region']}')")
    sql(f"UPDATE public.members SET region_id={r1} WHERE id='{IDS['member']}'")
    race('registration-suspension', f"UPDATE public.members SET account_status='suspended' WHERE id='{IDS['member']}'",
         worker_query(IDS['member'], f"SELECT public.submit_lounge_form('{FORM_IDS['suspension']}', '{{}}')"),
         f"SELECT NOT EXISTS(SELECT 1 FROM public.form_responses WHERE form_id='{FORM_IDS['suspension']}')")
    sql(f"UPDATE public.members SET account_status='active' WHERE id='{IDS['member']}'")
    race('registration-event-unpublish', f"UPDATE public.events SET published_at=NULL WHERE id='{IDS['publication']}'",
         worker_query(IDS['member'], f"SELECT public.submit_lounge_form('{FORM_IDS['publication']}', '{{}}')"),
         f"SELECT NOT EXISTS(SELECT 1 FROM public.form_responses WHERE form_id='{FORM_IDS['publication']}')")
    sql(f"UPDATE public.members SET account_status='suspended' WHERE id='{IDS['rc']}'")
    result = subprocess.run(PSQL + ['-c', worker_query(IDS['rc'], f"SELECT public.save_announcement('{{\"title\":\"Denied\",\"body\":\"Suspended RC\",\"region_id\":{r1}}}')")], text=True, capture_output=True, timeout=15)
    if result.returncode == 0 or '42501' not in result.stderr or 'Account is not active' not in result.stderr:
        raise AssertionError(f'suspended notice writer was accepted: {result.stderr}')
    print('PASS suspended-notice-writer: explicitly denied 42501 Account is not active', flush=True)
finally:
    cleanup()
