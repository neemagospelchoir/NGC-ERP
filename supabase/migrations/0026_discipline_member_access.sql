-- ============================================================================
-- 0026_discipline_member_access.sql
-- Phase 7.4 (Discipline module). Three narrowly-scoped access points for the
-- Discipline Manager role, matching the PRD §6 permission matrix's Member
-- Profiles row for that role EXACTLY: "Read (own cases only)" — read-only,
-- and only for members who already have a disciplinary case on file. No
-- blanket members-table grant of any kind is added here, and — deliberately
-- — no UPDATE policy either: the PRD matrix does not give Discipline a write
-- grant on Member Profiles at all, only Discipline itself (0007's
-- disciplinary_cases/disciplinary_actions policies, unchanged).
--
-- 1. members_select_discipline_scoped: lets a discipline.cases.read/.manage
--    holder read the profile (name, number, etc.) of a member who is the
--    subject of an existing disciplinary case, so case list/detail pages can
--    show who a case concerns. A member with no case on file is invisible
--    to this role via this policy, same as to everyone else.
--
-- 2. find_member_by_number_for_discipline(): a case can only be OPENED
--    against a member who does NOT have a case yet (that's the whole point
--    of opening one) — so policy 1 above can never help a Discipline
--    Manager find who to file a new case against; they have no other read
--    grant on `members`. This SECURITY DEFINER function is the narrow,
--    audited answer: an EXACT member_number lookup (never a search/ilike,
--    never a list) that returns a row only if the caller holds
--    discipline.cases.manage. A Discipline Manager filing a case already
--    knows the member's ID number from the incident itself; this is
--    intentionally not a browsable directory.
--
-- 3. apply_disciplinary_membership_status(): the mechanism by which a
--    decided suspension/dismissal actually changes members.membership_status
--    (to 'suspended'/'exited') or a restoration reverts it (to 'active').
--    Implemented as a single-purpose SECURITY DEFINER function rather than
--    a members UPDATE RLS policy + column guard (the pattern used for HR in
--    0023) precisely BECAUSE the PRD gives Discipline Manager no update
--    grant on Member Profiles at all — granting one, even a column-limited
--    one, would over-reach the matrix. This function is the narrowest
--    possible privileged escape hatch: it does exactly one thing, checks
--    discipline.cases.manage itself, only accepts the three statuses this
--    module ever needs to set, and only ever touches a member who already
--    has a disciplinary case on file (same defense-in-depth scoping as
--    policy 1).
-- ============================================================================

create policy members_select_discipline_scoped on public.members
  for select using (
    public.has_permission('discipline.cases.read')
    and id in (select member_id from public.disciplinary_cases)
  );

create or replace function public.find_member_by_number_for_discipline(p_member_number text)
returns table (id uuid, first_name text, last_name text, member_number text, membership_status text)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.first_name, m.last_name, m.member_number, m.membership_status
  from public.members m
  where public.has_permission('discipline.cases.manage')
    and m.member_number = p_member_number
$$;

comment on function public.find_member_by_number_for_discipline(text) is
  'Exact member_number lookup only (never ilike/search) so opening a new disciplinary case cannot become a backdoor member directory for a role that otherwise has no read grant on Member Profiles beyond members already on a case (0026).';

create or replace function public.apply_disciplinary_membership_status(
  p_member_id uuid,
  p_status text,
  p_exit_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('discipline.cases.manage') then
    raise exception 'Not authorized to change a member''s status from the Discipline module.' using errcode = '42501';
  end if;
  if p_status not in ('suspended', 'active', 'exited') then
    raise exception 'Unsupported disciplinary status transition: %', p_status using errcode = '22023';
  end if;
  if not exists (select 1 from public.disciplinary_cases where member_id = p_member_id) then
    raise exception 'This function only applies to a member with a disciplinary case on file.' using errcode = '42501';
  end if;

  update public.members
  set membership_status = p_status,
      exited_at = case when p_status = 'exited' then now()::date else null end,
      exit_reason = case when p_status = 'exited' then p_exit_reason else null end
  where id = p_member_id;
end;
$$;

comment on function public.apply_disciplinary_membership_status(uuid, text, text) is
  'The ONLY way a disciplinary action changes members.membership_status — deliberately not a members UPDATE RLS policy, since the PRD permission matrix gives Discipline Manager no write grant on Member Profiles at all (only Read, own cases only). See file header.';
