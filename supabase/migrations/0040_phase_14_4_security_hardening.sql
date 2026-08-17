-- ============================================================================
-- 0040_phase_14_4_security_hardening.sql
-- Phase 14.4 (QA capstone). Closes two real, previously-unfound gaps
-- discovered by an independent adversarial security review commissioned
-- specifically to sweep every module 14.1 did NOT already target, plus one
-- lower-severity insert-time integrity gap flagged the same pass.
--
-- GAP 1 — the 0036 workflow-governed-status guard only examined the ONE
-- specific "from" status each table's own service-layer code happens to
-- sync from (`pending_management_approval` for invitations,
-- `pending_approval` for expense_requests/gate_passes). If `old.status` was
-- anything else, the trigger's outer `if` never fired at all, leaving the
-- flat, permission-only RLS UPDATE policy (`invitations_write_scoped`,
-- `expense_requests_update_scoped` — neither restricts by current status)
-- as the ONLY gate. Both `invitations` and `expense_requests` have real
-- pre-approval statuses besides the one guarded value (invitations: draft,
-- submitted, received, under_review, pending_information; expense_requests:
-- draft, submitted) — so a holder of `events.invitations.manage` or
-- `finance.expenses.manage`/`.approve` could issue a direct REST PATCH
-- jumping straight from any of those EARLIER statuses to `approved`
-- (or invitations' `declined`), skipping the entire approval chain and
-- `record_workflow_decision` together, with no `workflow_instances` row
-- ever created. This is the exact bypass class 0036 itself was written to
-- close — 0036 closed the "sync after a real decision, but the decision was
-- never real" shape; this migration closes the "never even reach the
-- guarded status at all" shape. `gate_passes` is unaffected in practice
-- (its own initial status is already `pending_approval` — there is no
-- earlier status to jump from), so this is a genuine behavior change only
-- for invitations and expense_requests, and a no-op improvement for gate
-- passes.
--
-- THE FIX: the guard now ALSO checks — independent of `old.status` —
-- whether `new.status` is one of the workflow-decision-outcome values this
-- table's guarded pairs name (e.g. `approved`, invitations' `declined`).
-- If so, `workflow_instances` must already reflect the matching outcome for
-- this exact record, regardless of what `old.status` was. The pre-existing
-- "any OTHER unrecognized exit from the specific guarded old status is
-- blocked unless allowlisted" behavior (the exact shape validated by smoke
-- test scenarios A5/C1) is left completely unchanged — this is an
-- ADDITIONAL check, not a replacement of the original one.
--
-- GAP 2 — `event_attendance_write_scoped` (0008) is `for all using
-- (has_permission('attendance.records.manage'))` with no `with check`
-- clause at all, so `recorded_by` is fully caller-forgeable — the identical
-- bug shape 0038 already found and fixed on the sibling `attendance` table
-- (rehearsal/session attendance). 0038's own scope note ("attendance
-- itself... not attendance_sessions/leave_requests") evidently did not
-- consider `event_attendance` (on-the-day event attendance, a distinct
-- table from `attendance` per its own table comment at 0008) as a sibling
-- needing the same fix — this migration closes that same gap here.
--
-- GAP 3 (lower severity, insert-time integrity, not authorization) —
-- `procurement_requests_write_finance` (0014) lets any
-- `finance.procurement.manage` holder INSERT a procurement_requests row
-- against ANY expense_requests row regardless of its status; the "must be
-- an approved expense request" rule (packages/services/src/procurement/
-- create.ts) is enforced only in the application layer, so a direct REST
-- insert can create a procurement record against a draft/rejected expense
-- request, bypassing that precondition. Fixed with a BEFORE INSERT trigger
-- (not folded into RLS's WITH CHECK, deliberately — see note below) that
-- re-checks the same precondition create.ts already enforces, independent
-- of the client. Scoped to INSERT only, not UPDATE: expense_requests.status
-- can independently move to 'paid'/'closed' via Finance's own separate
-- markExpensePaid/closeExpenseRequest lifecycle (packages/services/src/
-- expenses/lifecycle.ts) WHILE a procurement_requests row for it is still
-- legitimately progressing through vendor_selected/purchased — a WITH
-- CHECK re-evaluated on every UPDATE would incorrectly block those already-
-- legitimate later-stage procurement writes the moment Finance closed the
-- underlying expense request out of band. A BEFORE INSERT trigger avoids
-- that false-positive entirely by only ever checking the precondition once,
-- at creation time, exactly when create.ts's own check also runs.
-- ============================================================================

-- --- Gap 1: close the "skip straight to approved, never touching the
-- guarded old status at all" bypass on invitations/expense_requests/gate_passes ---

create or replace function public.guard_workflow_governed_status_change() returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_record_type text := tg_argv[0];
    v_guarded_old_status text := tg_argv[1];
    v_guarded_pairs text[] := string_to_array(tg_argv[2], ',');
    v_always_allowed_statuses text[] := case when coalesce(tg_argv[3], '') = '' then array[]::text[] else string_to_array(tg_argv[3], ',') end;
    v_pair text;
    v_expected_instance_status text;
    v_matched boolean := false;
    v_instance record;
  begin
    if new.status is distinct from old.status then
      foreach v_pair in array v_guarded_pairs loop
        if split_part(v_pair, ':', 1) = new.status then
          v_matched := true;
          v_expected_instance_status := split_part(v_pair, ':', 2);
          exit;
        end if;
      end loop;

      if v_matched then
        -- Phase 14.4: this branch now fires whenever new.status is one of
        -- this table's workflow-decision-outcome values, REGARDLESS of
        -- old.status — not only when old.status is the one specific
        -- guarded "from" status. A workflow-governed outcome must always
        -- be backed by a matching workflow_instances row, no matter which
        -- earlier status the direct write is attempting to jump from.
        select * into v_instance
          from public.workflow_instances
          where record_type = v_record_type and record_id = old.id
          order by created_at desc
          limit 1;

        if v_instance is null or v_instance.status is distinct from v_expected_instance_status then
          raise exception
            'This status change must be recorded through the approval workflow (record_workflow_decision), not written directly.'
            using errcode = '42501';
        end if;

      elsif old.status = v_guarded_old_status then
        -- Original (0036) behavior, unchanged: from the one specific
        -- guarded "from" status, every OTHER exit not already handled
        -- above must be on the small "always allowed" allowlist of
        -- separately-gated, legitimately-unverified actions (e.g.
        -- invitations' cancelInvitation), or it is blocked outright.
        if not (new.status = any (v_always_allowed_statuses)) then
          raise exception
            'Cannot move directly from "%" to "%" — this must go through the approval workflow, or is not a recognized transition.', old.status, new.status
            using errcode = '42501';
        end if;
      end if;
      -- Neither branch applies: new.status is not a workflow-decision
      -- outcome, and old.status is not the specific guarded "from" status
      -- either — this transition is outside this guard's concern entirely
      -- (e.g. draft -> submitted, or marking an already-approved expense
      -- request paid/closed), same as before this migration.
    end if;
    return new;
  end;
  $$;

comment on function public.guard_workflow_governed_status_change() is
  'BEFORE UPDATE guard (0036, broadened by Phase 14.4/0040) preventing a direct client write from setting a workflow-governed status column (e.g. expense_requests.status = ''approved'') unless workflow_instances (only advanceable via record_workflow_decision) already reflects the corresponding outcome for the same record_type/record_id — checked regardless of the row''s prior status (0040 closed a bypass where a direct write skipped straight from an EARLY status, never touching the specific old status 0036 originally examined, straight to a workflow-decision outcome). Separately and additionally, from the specific guarded "from" status named at trigger-creation time, ANY other exit that is neither a verified workflow outcome nor on the small "always allowed" allowlist (4th argument) is also rejected. Takes 4 trigger arguments: record_type, the guarded "from" status, a comma-separated list of "new_status:expected_workflow_instances_status" pairs, and a comma-separated (or empty string) list of "to" statuses allowed through unverified from that specific "from" status.';

-- --- Gap 2: event_attendance.recorded_by WITH CHECK (sibling of 0038's attendance fix) ---

drop policy if exists event_attendance_write_scoped on public.event_attendance;

create policy event_attendance_write_scoped on public.event_attendance
  for all
  using (public.has_permission('attendance.records.manage'))
  with check (
    recorded_by = auth.uid()
    and public.has_permission('attendance.records.manage')
  );

comment on table public.event_attendance is
  'On-the-day event attendance (distinct from public.attendance, rehearsal/session attendance — see this table''s own original 0008 comment). recorded_by is tied to auth.uid() at the database layer (Phase 14.4/0040), the identical defense-in-depth fix 0038 already applied to the sibling attendance table.';

-- --- Gap 3: procurement_requests insert-time linkage to an approved expense request ---

create or replace function public.guard_procurement_request_insert_requires_approved_expense() returns trigger
  language plpgsql
  set search_path = public
  as $$
  begin
    if not exists (
      select 1 from public.expense_requests er
      where er.id = new.expense_request_id and er.status = 'approved'
    ) then
      raise exception 'A procurement request can only be created for an approved expense request.'
        using errcode = '42501';
    end if;
    return new;
  end;
  $$;

comment on function public.guard_procurement_request_insert_requires_approved_expense() is
  'BEFORE INSERT guard (Phase 14.4/0040) re-checking, at the database layer, the same precondition packages/services/src/procurement/create.ts already enforces in the application layer: a procurement request may only be created against an already-approved expense request. Deliberately INSERT-only (see this migration''s own file header) — expense_requests.status can legitimately move to paid/closed independently while an already-created procurement_requests row is still progressing through vendor_selected/purchased, and re-checking on every UPDATE would incorrectly block those already-legitimate later writes.';

create trigger guard_procurement_requests_insert_approved_expense
  before insert on public.procurement_requests
  for each row execute function public.guard_procurement_request_insert_requires_approved_expense();
