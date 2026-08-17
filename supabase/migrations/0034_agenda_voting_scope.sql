-- ============================================================================
-- 0034_agenda_voting_scope.sql
-- Phase 10.4 (Communications: Agenda & Voting). Two genuine gaps found
-- while building this phase's own service layer, fixed here rather than
-- left as documented-but-unenforced promises.
--
-- GAP 1 — vote eligibility was never actually checked at write time.
-- `votes_insert_self` (0017) only checked `voter_id = auth.uid()` — it
-- never looked at the agenda's own `eligible_voter_scope`/
-- `eligible_department_id`/`eligible_family_id`/`eligible_user_ids`, nor
-- its `status`/`voting_deadline`. That meant ANY signed-in user could cast
-- a binding vote on an agenda item explicitly scoped to one department,
-- one family, leadership, or a specific user list — not an
-- information-disclosure gap like most of this codebase's other caught
-- bugs, but a vote-INTEGRITY gap: an ineligible member's vote would count
-- toward `agenda_results` exactly the same as an eligible one's, and
-- nothing except client-side "who should see this ballot" UI logic
-- actually stopped it, and nothing at all stopped voting after the
-- deadline or on a draft/closed/cancelled agenda. Fixed by folding
-- eligibility + open/deadline checks directly into the INSERT policy's own
-- `with check` clause — the same "RLS is the actual gate, not app-layer
-- convenience" principle 0024 states explicitly.
-- `eligible_voter_scope = 'leadership'` is resolved as
-- `has_permission('management.agenda.manage')` — the same permission that
-- already identifies this schema's leadership roles (secretary, chairman,
-- vice_chairman, super_admin per the seed) everywhere else RLS needs to
-- ask "is this caller leadership", since no separate "leadership"
-- role/flag exists anywhere in this schema to check instead.
--
-- GAP 2 — `votes_select_own_or_admin` (0017) let ANY
-- `management.agenda.manage` holder read every voter_id -> choice row for
-- EVERY agenda, anonymous or not. The `agenda_results` view's own comment
-- already states the intended guarantee precisely: "Never join
-- votes.voter_id into any view/query exposed to a non-Super-Admin role for
-- an is_anonymous agenda" — but names the service/API layer as where that
-- must be enforced, not RLS. An app-layer-only promise is not a real
-- boundary under this codebase's own stated model (0024): a secretary or
-- chairman who queries `votes` directly (devtools, a raw PostgREST call, a
-- future caller that simply forgets the app-layer check) would see the
-- exact anonymous voter->choice mapping anonymity is supposed to hide.
-- Fixed by moving that promise into the policy itself: a
-- `management.agenda.manage` holder may read every row of a NON-anonymous
-- agenda's votes (needed for e.g. auditing/verifying individual ballots
-- when integrity, not privacy, is the concern — PRD S14.9 distinguishes
-- the two), but for an `is_anonymous` agenda, only the voter's own row or
-- a true `has_role('super_admin')` caller may read raw rows. Everyone else
-- still gets the full aggregate tally via `agenda_results` (unaffected —
-- it never exposed voter_id to begin with), just never the per-voter
-- mapping for an agenda marked anonymous.
-- ============================================================================

drop policy votes_insert_self on public.votes;

create policy votes_insert_self on public.votes
  for insert with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.agendas a
      where a.id = votes.agenda_id
        and a.status = 'open'
        and a.voting_deadline > now()
        and (
          a.eligible_voter_scope = 'all_members'
          or (
            a.eligible_voter_scope = 'department'
            and exists (
              select 1 from public.members m
              where m.user_id = auth.uid() and m.primary_department_id = a.eligible_department_id
            )
          )
          or (
            a.eligible_voter_scope = 'family'
            and exists (
              select 1 from public.members m
              where m.user_id = auth.uid() and m.family_id = a.eligible_family_id
            )
          )
          or (a.eligible_voter_scope = 'leadership' and public.has_permission('management.agenda.manage'))
          or (a.eligible_voter_scope = 'specific_users' and auth.uid() = any (a.eligible_user_ids))
        )
    )
  );

drop policy votes_select_own_or_admin on public.votes;

create policy votes_select_own_or_admin on public.votes
  for select using (
    voter_id = auth.uid()
    or public.has_role('super_admin')
    or (
      public.has_permission('management.agenda.manage')
      and exists (
        select 1 from public.agendas a
        where a.id = votes.agenda_id and a.is_anonymous = false
      )
    )
  );
