-- ============================================================================
-- 0036_workflow_direct_write_hardening.sql
-- Phase 14.1 (QA). Closes a real, previously-flagged-but-deferred
-- authorization gap named independently in docs/PHASE_9_2.md and
-- docs/PHASE_9_3.md ("any finance.expenses.manage/.approve holder can
-- bypass the approval chain entirely via a direct REST write... no RLS
-- tying the write to the current workflow step") and confirmed by this
-- phase's own direct inspection to also be true, unflagged until now, of
-- Invitations (Phase 7.5) and Gate Pass (Phase 8.3).
--
-- THE GAP: `expenses/workflow.ts`, `gate-passes/workflow.ts`, and
-- `invitations/approval.ts` each call the SECURITY DEFINER
-- `record_workflow_decision` (0028/0030) — which correctly re-verifies the
-- caller matches the CURRENT step's required role/user before advancing
-- `workflow_instances` — and then, once that RPC reports the workflow
-- fully `approved`/`rejected`, separately issue a plain client `.update
-- ({status: ...})` on the underlying `expense_requests`/`gate_passes`/
-- `invitations` row to sync its own status column. That second write is
-- gated ONLY by each table's flat RLS permission check
-- (`finance.expenses.manage`/`.approve`, `inventory.gate_passes.manage` or
-- `person_responsible_id`, `events.invitations.manage`) — nothing ties it
-- to whether the workflow was actually, legitimately advanced. Any holder
-- of that flat permission could set `status = 'approved'` directly at any
-- time, skipping every configured approver in the chain, and the write
-- would succeed. Separately, `workflow_instances_write_service` (0019)
-- itself grants `for all` (not just insert) to any `management.approvals.
-- manage` holder — broader than the one thing that permission is actually
-- ever used for (`workflow.startWorkflow()`'s insert) — so a Secretary/
-- Chairman/Vice Chairman (the only holders, per the seed) could also
-- directly overwrite `workflow_instances.status` itself, which
-- `record_workflow_decision`'s own comment already says that permission
-- is explicitly NOT meant to allow ("administrative override... not step
-- impersonation").
--
-- THE FIX, in two parts:
--
-- 1. `workflow_instances_write_service` is replaced with an INSERT-only
--    policy. The only legitimate direct client write to this table is
--    `startWorkflow()`'s insert of a fresh `status = 'pending'` row; every
--    other write (advancing status/current_step_order) already goes
--    through `record_workflow_decision`, a SECURITY DEFINER function whose
--    internal writes are unaffected by this narrowing (SECURITY DEFINER
--    functions execute as their owner, which bypasses RLS the same way
--    `write_audit_log()` already does). This closes the "overwrite
--    workflow_instances directly" half of the gap.
--
-- 2. A new generic trigger function, `guard_workflow_governed_status_
--    change()`, is attached (BEFORE UPDATE) to `invitations`,
--    `expense_requests`, and `gate_passes`. It only ever intervenes for
--    the ONE specific transition each table's own service-layer code
--    performs immediately after a workflow reaches its final decision
--    (`pending_management_approval` -> `approved`/`declined` for
--    invitations; `pending_approval` -> `approved`/`rejected` for the
--    other two) — every other status transition on these tables (draft
--    submission, marking paid/closed, checkout/in-transit/return, internal
--    review's own earlier transitions) is untouched. For a guarded
--    transition, it re-reads `workflow_instances` (bypassing RLS, since
--    this function is itself SECURITY DEFINER) for that exact
--    `record_type`/`record_id` and requires the instance to ALREADY show
--    the same status being written. Since (1) means `workflow_instances.
--    status` can only reach `approved`/`rejected` via `record_workflow_
--    decision` — which independently re-verifies the caller is the
--    correct current-step approver — this makes the "sync the record's
--    own status" write conditional on a real, already-completed,
--    correctly-authorized workflow decision, closing the gap without
--    moving any of the existing side-effect logic (e.g. `invitations.
--    approval.ts`'s `createEventFromInvitation` call) out of TypeScript
--    and into SQL, and without needing any session-local/GUC "ticket"
--    mechanism (which would not survive across the separate HTTP
--    requests/transactions a Supabase-JS `.rpc()` call and a following
--    `.update()` call actually are).
--
-- Procurement is a related but distinct case: it has no `workflow_
-- instances` row at all (its status machine — pending -> vendor_selected
-- -> purchased, with cancellation from either of the first two — is a
-- sequence of Finance-driven operational steps, not a peer-approval
-- chain), so the "same class of gap" named in docs/PHASE_9_3.md is really
-- about a `finance.procurement.manage` holder being able to jump the
-- status column to an illegal state directly (e.g. `pending` straight to
-- `purchased`, skipping vendor selection, or resurrecting a `cancelled`/
-- `purchased` terminal request) — fixed here with a plain state-machine
-- transition-validity trigger, no `workflow_instances` involved.
-- ============================================================================

-- --- Part 1: workflow_instances direct writes narrowed to insert-only ---

drop policy if exists workflow_instances_write_service on public.workflow_instances;

create policy workflow_instances_insert_service on public.workflow_instances
  for insert with check (public.has_permission('management.approvals.manage'));

comment on table public.workflow_instances is
  'Advanced ONLY via the record_workflow_decision() SECURITY DEFINER RPC (0028/0030) — direct client UPDATE/DELETE is not granted to any role (0036). The one legitimate direct write is workflow.startWorkflow()''s insert, gated by management.approvals.manage.';

-- --- Part 2: guard the workflow-governed status sync on the 3 record tables ---

-- NOTE: an earlier draft of this trigger only intervened when `new.status`
-- was one of the guarded "to" values (approved/rejected/declined), leaving
-- every OTHER direct exit from the guarded "from" status completely
-- unguarded. Manual verification against a live Postgres instance (this
-- phase's own validation pass) caught a real residual hole that shape
-- would have shipped with: a gate pass's `person_responsible_id` (who
-- needs no special permission at all, per `gate_passes_write_scoped`)
-- could jump `pending_approval` directly to `checked_out` — skipping
-- approval entirely, not forging its outcome — which the original design
-- didn't consider a "guarded new status" at all. Fixed by guarding EVERY
-- exit from the guarded "from" status, not just the two forgeable
-- outcomes: any other target must be on an explicit, small "always
-- allowed" allowlist (the 4th trigger argument) representing a real,
-- separately-gated business action that legitimately leaves this status
-- without an approval decision — today that is exactly ONE case,
-- invitations' `cancelInvitation` (pending_management_approval ->
-- cancelled, gated by `events.invitations.manage`, PRD-legitimate at any
-- pre-approved stage) — everything else, for every table, has no such
-- case and gets an empty allowlist.
--
-- A SECOND draft compared `new.status` directly against `workflow_
-- instances.status` for equality. An independent adversarial security
-- review (dispatched as part of this same phase's own validation, before
-- ship) caught that this is wrong for invitations specifically:
-- `invitations.status`'s rejection value is `'declined'` (0008), but
-- `workflow_instances.status` and `record_workflow_decision`'s reject
-- branch (0030) only ever use `'rejected'` — the two vocabularies never
-- match, so `decideInvitationApproval`'s own legitimate, correctly-
-- recorded rejection sync-update would have been unconditionally blocked
-- by this trigger, permanently stuck at `pending_management_approval`
-- with no recovery path (the workflow instance itself would already be
-- terminal at `rejected`, so even retrying the decision would fail
-- `record_workflow_decision`'s own `status <> 'pending'` precondition) —
-- a total regression of a working Phase 7.5 feature, caught before ship
-- rather than after. `expense_requests`/`gate_passes` both use
-- `'rejected'` verbatim (matching `workflow_instances` exactly, per 0014/
-- 0011), so only invitations' distinct terminology was affected. Fixed by
-- making the guarded "to" list a set of `new_status:instance_status`
-- pairs rather than assuming they're always spelled the same.
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
    if old.status = v_guarded_old_status and new.status is distinct from old.status then
      foreach v_pair in array v_guarded_pairs loop
        if split_part(v_pair, ':', 1) = new.status then
          v_matched := true;
          v_expected_instance_status := split_part(v_pair, ':', 2);
          exit;
        end if;
      end loop;

      if v_matched then
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
      elsif new.status = any (v_always_allowed_statuses) then
        -- A real, separately-permission-gated exit that legitimately
        -- bypasses the approval decision entirely (e.g. withdrawing an
        -- invitation while it awaits approval) — nothing further to check.
        null;
      else
        raise exception
          'Cannot move directly from "%" to "%" — this must go through the approval workflow, or is not a recognized transition.', old.status, new.status
          using errcode = '42501';
      end if;
    end if;
    return new;
  end;
  $$;

comment on function public.guard_workflow_governed_status_change() is
  'BEFORE UPDATE guard (Phase 14.1) preventing a direct client write from setting a workflow-governed status column (e.g. expense_requests.status = ''approved'') unless workflow_instances (only advanceable via record_workflow_decision, per 0036 Part 1) already reflects the corresponding outcome for the same record_type/record_id — and, more broadly, rejecting ANY direct exit from the guarded status that is neither a verified workflow outcome nor on the small "always allowed" allowlist (4th argument) of separately-gated non-approval exits. Takes 4 trigger arguments: record_type, the guarded "from" status, a comma-separated list of "new_status:expected_workflow_instances_status" pairs (not assumed to be spelled the same — see this function''s own comment on invitations'' declined/rejected mismatch), and a comma-separated (or empty string) list of "to" statuses allowed through unverified.';

create trigger guard_invitations_approval_status
  before update on public.invitations
  for each row execute function public.guard_workflow_governed_status_change('invitation', 'pending_management_approval', 'approved:approved,declined:rejected', 'cancelled');

create trigger guard_expense_requests_approval_status
  before update on public.expense_requests
  for each row execute function public.guard_workflow_governed_status_change('expense_request', 'pending_approval', 'approved:approved,rejected:rejected', '');

create trigger guard_gate_passes_approval_status
  before update on public.gate_passes
  for each row execute function public.guard_workflow_governed_status_change('gate_pass', 'pending_approval', 'approved:approved,rejected:rejected', '');

-- --- Part 3: procurement_requests status-transition-validity guard ---

create or replace function public.guard_procurement_request_status_transition() returns trigger
  language plpgsql
  set search_path = public
  as $$
  begin
    if new.status is distinct from old.status then
      if not (
        (old.status = 'pending' and new.status in ('vendor_selected', 'cancelled'))
        or (old.status = 'vendor_selected' and new.status in ('purchased', 'cancelled'))
      ) then
        raise exception 'Cannot move a procurement request from "%" to "%".', old.status, new.status
          using errcode = '22023';
      end if;
    end if;
    return new;
  end;
  $$;

comment on function public.guard_procurement_request_status_transition() is
  'BEFORE UPDATE guard (Phase 14.1) enforcing the legal procurement_requests status graph (pending -> vendor_selected|cancelled -> purchased|cancelled) at the database layer, so a finance.procurement.manage holder cannot skip a stage (or reanimate a terminal purchased/cancelled request) via a direct REST write, independent of whether the application layer''s own precondition checks (vendor.ts/purchase.ts/cancel.ts) are bypassed.';

create trigger guard_procurement_requests_status
  before update on public.procurement_requests
  for each row execute function public.guard_procurement_request_status_transition();
