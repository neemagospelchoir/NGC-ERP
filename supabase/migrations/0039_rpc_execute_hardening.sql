-- ============================================================================
-- 0039_rpc_execute_hardening.sql
-- Phase 14.1 (QA). Closes a standing, whole-schema gap named explicitly in
-- 0033_send_notification.sql's own comment and repeated across
-- docs/PHASE_10_2.md §7: "PUBLIC/anon hold EXECUTE on every SECURITY
-- DEFINER RPC in this schema" — Postgres grants EXECUTE on a newly created
-- function to PUBLIC by default (unlike tables, which default to no
-- access), and none of 0026, 0028/0030, 0029, 0031, or 0033 ever issued an
-- explicit `revoke ... from public` to close that default. Every one of
-- these functions already re-verifies the caller's own permission/role
-- internally (has_permission(...) checks, or record_workflow_decision's
-- own current-step-approver match), so this is defense-in-depth, not a
-- fix for a confirmed exploit — but an anonymous or otherwise-unrelated
-- authenticated caller should not be able to invoke these at all, not rely
-- on the function's own internal check to fail closed every time.
--
-- Note (carried over from 0033's own comment, re-confirmed here): in this
-- sandbox's LOCAL DEV auth-shim database only, 0024_local_dev_role_grants.
-- sql's `alter default privileges in schema public grant execute on
-- functions to anon, authenticated` re-grants EXECUTE the moment any new
-- function is created, regardless of this migration's revoke — that
-- statement is explicitly guarded to only ever run against the local-dev
-- shim (0024's own file header), never a real Supabase project, so it is
-- not a regression of this migration's intent in production.
-- ============================================================================

revoke execute on function public.find_member_by_number_for_discipline(text) from public;
grant execute on function public.find_member_by_number_for_discipline(text) to authenticated;

revoke execute on function public.apply_disciplinary_membership_status(uuid, text, text) from public;
grant execute on function public.apply_disciplinary_membership_status(uuid, text, text) to authenticated;

revoke execute on function public.record_workflow_decision(uuid, text, text) from public;
grant execute on function public.record_workflow_decision(uuid, text, text) to authenticated;

revoke execute on function public.start_gate_pass_workflow(uuid) from public;
grant execute on function public.start_gate_pass_workflow(uuid) to authenticated;

revoke execute on function public.start_expense_request_workflow(uuid) from public;
grant execute on function public.start_expense_request_workflow(uuid) to authenticated;

revoke execute on function public.send_notification(text, uuid, uuid, uuid[], text, text, text, uuid, text, text, uuid) from public;
grant execute on function public.send_notification(text, uuid, uuid, uuid[], text, text, text, uuid, text, text, uuid) to authenticated;

-- The two new SECURITY DEFINER functions this same phase adds (0036's
-- guard_workflow_governed_status_change/guard_procurement_request_status_
-- transition) are trigger functions, never called directly by a client —
-- Postgres does not grant EXECUTE on trigger functions to PUBLIC/anon in a
-- way any role could exploit (triggers execute in the context of the
-- statement that fired them, not via a callable RPC surface), so no
-- revoke is needed for those.
