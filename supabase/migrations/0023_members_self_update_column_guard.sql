-- ============================================================================
-- 0023_members_self_update_column_guard.sql
-- Phase 7.1 (Members module). Closes a real gap found while building the
-- Members service layer: policy `members_update_self_limited` (0004) is
-- named "limited" but its USING clause only gates which ROWS a self-update
-- may touch (their own), not which COLUMNS. Row Level Security cannot
-- express column-level restrictions on its own — a non-privileged member
-- could otherwise UPDATE their own row's membership_status, member_number,
-- department/family assignment, or exit fields directly via PostgREST,
-- bypassing the HR-only workflow those fields are meant to require. This is
-- exactly the class of gap spec S52 warns about ("enforce RBAC at the
-- database layer, not just the UI") — closing it at the trigger layer, not
-- just by trusting the application to never expose those fields in a form.
--
-- Design: only the SELF-UPDATE-WITHOUT-PRIVILEGE path is restricted. Any
-- session that either (a) holds members.profiles.manage, or (b) is not
-- acting as the row's own user (HR/admin, or the RLS-bypassing service-role
-- client used by a future onboarding-approval transaction, which carries no
-- auth.uid() at all) is left untouched by this trigger — RLS policies and
-- application-layer authorize() calls remain the gate for those paths.
--
-- Column split (a judgment call, documented rather than silently assumed):
-- self-editable = contact/display info a member should be able to correct
-- themselves (name, preferred name, photo, contact details, address,
-- emergency contact, gender, nationality). HR-only even for the row owner =
-- identity/status fields where a self-service change would be a fraud or
-- data-integrity risk: national_id_number, date_of_birth, member_number,
-- user_id, application_id, primary_department_id, family_id,
-- membership_status, joined_at, exited_at, exit_reason, qr_token.
--
-- SECURITY DEFINER (matching has_permission()/current_user_department_ids()
-- elsewhere in this schema): the function body calls auth.uid(), which a
-- plain `authenticated`-role caller has no direct USAGE grant on the `auth`
-- schema to invoke — SECURITY DEFINER runs it as the function owner instead,
-- exactly like every other helper function in this schema that touches
-- auth.uid() internally.
-- ============================================================================

create or replace function public.enforce_members_self_update_column_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only restrict the specific case this trigger exists for: the row's own
  -- (non-privileged) user updating their own record. Every other caller
  -- (HR/admin with the permission, or a service-role/no-JWT context such as
  -- an onboarding-approval transaction) is left alone.
  if old.user_id is not null
     and old.user_id = auth.uid()
     and not public.has_permission('members.profiles.manage')
  then
    if new.national_id_number is distinct from old.national_id_number
       or new.date_of_birth is distinct from old.date_of_birth
       or new.member_number is distinct from old.member_number
       or new.user_id is distinct from old.user_id
       or new.application_id is distinct from old.application_id
       or new.primary_department_id is distinct from old.primary_department_id
       or new.family_id is distinct from old.family_id
       or new.membership_status is distinct from old.membership_status
       or new.joined_at is distinct from old.joined_at
       or new.exited_at is distinct from old.exited_at
       or new.exit_reason is distinct from old.exit_reason
       or new.qr_token is distinct from old.qr_token
    then
      raise exception
        'Members may not change identity, status, or assignment fields on their own record. Contact an administrator.'
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_members_self_update_column_guard() is
  'Column-level companion to the members_update_self_limited RLS policy (0004): RLS alone cannot restrict which columns a self-update may touch, only which rows. See file header for the self-editable/HR-only column split and rationale.';

create trigger trg_members_self_update_column_guard
  before update on public.members
  for each row execute function public.enforce_members_self_update_column_guard();
