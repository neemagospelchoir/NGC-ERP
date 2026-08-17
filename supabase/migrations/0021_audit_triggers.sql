-- ============================================================================
-- 0021_audit_triggers.sql
-- Attaches the generic write_audit_log() trigger (defined in 0001) to every
-- table the spec explicitly calls out as needing an audit trail (S51
-- examples: member edited/approved/suspended, contribution changed, expense
-- approved, asset assigned, gate pass approved, invitation approved,
-- document uploaded, role changed) plus the other confidentiality- or
-- money-sensitive tables that share the same requirement by the same logic.
-- ============================================================================

create trigger audit_members after insert or update or delete on public.members
  for each row execute function public.write_audit_log();
create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.write_audit_log();
create trigger audit_applications after insert or update or delete on public.applications
  for each row execute function public.write_audit_log();
create trigger audit_probation after insert or update or delete on public.probation
  for each row execute function public.write_audit_log();
create trigger audit_leave_requests after insert or update or delete on public.leave_requests
  for each row execute function public.write_audit_log();
create trigger audit_disciplinary_cases after insert or update or delete on public.disciplinary_cases
  for each row execute function public.write_audit_log();
create trigger audit_disciplinary_actions after insert or update or delete on public.disciplinary_actions
  for each row execute function public.write_audit_log();
create trigger audit_invitations after insert or update or delete on public.invitations
  for each row execute function public.write_audit_log();
create trigger audit_events after insert or update or delete on public.events
  for each row execute function public.write_audit_log();
create trigger audit_asset_assignments after insert or update or delete on public.asset_assignments
  for each row execute function public.write_audit_log();
create trigger audit_gate_passes after insert or update or delete on public.gate_passes
  for each row execute function public.write_audit_log();
create trigger audit_contribution_records after insert or update or delete on public.contribution_records
  for each row execute function public.write_audit_log();
create trigger audit_expense_requests after insert or update or delete on public.expense_requests
  for each row execute function public.write_audit_log();
create trigger audit_purchase_orders after insert or update or delete on public.purchase_orders
  for each row execute function public.write_audit_log();
create trigger audit_documents after insert or update or delete on public.documents
  for each row execute function public.write_audit_log();
create trigger audit_workflow_step_decisions after insert on public.workflow_step_decisions
  for each row execute function public.write_audit_log();
create trigger audit_votes after insert on public.votes
  for each row execute function public.write_audit_log();
create trigger audit_system_settings after insert or update or delete on public.system_settings
  for each row execute function public.write_audit_log();
