-- ============================================================================
-- 0027_discipline_lookup_audit_and_hardening.sql
-- Two follow-up fixes from this same phase's security review, applied
-- immediately rather than only documented (same practice as every prior
-- phase's review-driven migrations):
--
-- 1. find_member_by_number_for_discipline() (0026) is a legitimate
--    exact-match lookup by design, but member_number is sequential and
--    predictable (`NGC-{year}-{sequence}`) — a discipline.cases.manage
--    holder could iterate it to enumerate the ENTIRE membership directory
--    (name + status for every guessed number), well beyond the PRD's
--    "Read (own cases only)" grant for this role. This is an insider-risk
--    concern (still requires holding the permission; not an authz
--    bypass), not something rate-limiting alone can fully close within
--    this schema (no request-rate-limit infrastructure exists anywhere in
--    this codebase yet — flagged as a real gap, not silently solved).
--    The mitigation applied here: every call is now written to
--    `audit_logs` — found or not — so a pattern of many distinct lookups
--    in a short window is visible to whoever reviews the audit log
--    (spec S41's "every disciplinary [-adjacent] change/action must be
--    auditable" already establishes this module as audit-everything).
--    This is deterrence/detection, not prevention — noted explicitly as a
--    flagged residual risk in docs/PHASE_7_4.md, not claimed as solved.
--
-- 2. members_select_discipline_scoped (0026) checked only
--    `discipline.cases.read`, matching disciplinary_cases_select_
--    discipline_only's (0007) existing pattern of relying on seed data to
--    always pair `.read` with `.manage` on the Discipline Manager role —
--    but that pairing is a seed-data convention, not something this
--    policy itself enforces. Broadened to check `.read OR .manage`
--    directly so a future role holding only `.manage` (without a
--    separately-granted `.read`) isn't silently unable to see the
--    profiles its own case-management work requires. 0007's own policies
--    are left untouched (already shipped/tested in Phase 4; out of scope
--    for this phase to revisit).
-- ============================================================================

drop policy if exists members_select_discipline_scoped on public.members;
create policy members_select_discipline_scoped on public.members
  for select using (
    (public.has_permission('discipline.cases.read') or public.has_permission('discipline.cases.manage'))
    and id in (select member_id from public.disciplinary_cases)
  );

create or replace function public.find_member_by_number_for_discipline(p_member_number text)
returns table (id uuid, first_name text, last_name text, member_number text, membership_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
begin
  select m.id, m.first_name, m.last_name, m.member_number, m.membership_status
  into v_match
  from public.members m
  where public.has_permission('discipline.cases.manage')
    and m.member_number = p_member_number
  limit 1;

  insert into public.audit_logs (actor_id, action, module, record_type, record_id, after_value)
  values (
    auth.uid(),
    'discipline.member_lookup',
    'discipline',
    'members',
    v_match.id,
    jsonb_build_object('member_number_queried', p_member_number, 'found', v_match.id is not null)
  );

  if v_match.id is not null then
    return query select v_match.id, v_match.first_name, v_match.last_name, v_match.member_number, v_match.membership_status;
  end if;
  return;
end;
$$;

comment on function public.find_member_by_number_for_discipline(text) is
  'Exact member_number lookup only (never ilike/search) so opening a new disciplinary case cannot become a backdoor member directory for a role that otherwise has no read grant on Member Profiles beyond members already on a case (0026). Every call is audit-logged (0027, found or not) as a detective control against enumeration, since member_number is sequential/guessable and this function is otherwise the one place this role can read an arbitrary member — see 0027''s file header for why this is deterrence, not prevention.';
