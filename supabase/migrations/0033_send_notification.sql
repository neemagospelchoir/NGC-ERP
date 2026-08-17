-- ============================================================================
-- 0033_send_notification.sql
-- Phase 10.2 (Communication: Notifications). A CRITICAL, genuinely-shipped
-- bug found and fixed by this phase's own security review, before the
-- service layer this migration replaces was ever committed.
--
-- THE BUG: the original `sendNotification` (packages/services/src/
-- notifications/send.ts) resolved an `all`/`department`/`family` audience
-- by querying `users`/`members` directly through the CALLER'S OWN
-- RLS-scoped client, then bulk-inserted into `notifications` via
-- `.insert(rows).select("*")`. Two RLS interactions combined to make this
-- non-functional for anyone who isn't `super_admin`:
--   1. `users_select_self`/`members_select_scoped` RLS already narrows a
--      caller who holds only `communications.notifications.send` (exactly
--      what this phase's own seed change grants `pro_spokesperson`) down to
--      their OWN row — so resolving "all active users" or "everyone in
--      department X" returned, at most, the sender themselves.
--   2. Postgres requires every row returned by an INSERT ... RETURNING to
--      also satisfy the table's SELECT policy. `notifications_select_own`
--      only allows `recipient_user_id = auth.uid() OR has_permission(
--      'communications.notifications.read_all')` — since `pro_spokesperson`
--      holds neither, the moment ANY row in the batch was addressed to
--      someone other than the sender, the RETURNING clause violated RLS and
--      Postgres aborted the ENTIRE multi-row insert, not just that row.
--
-- Net effect, verified directly against live Postgres using the real
-- `pro_spokesperson` role and its real grants: this role — the one PRD
-- names as owning "Full Communications" — could only ever successfully
-- send a notification to ITSELF. Every real broadcast threw.
--
-- THE FIX: the same "narrow, purpose-built escape hatch" SECURITY DEFINER
-- RPC pattern already used four times in this schema (0026, 0028, 0029,
-- 0031) — extended a fifth time. `send_notification` runs as its owning
-- role (which, unlike an ordinary session, is not subject to
-- `users_select_self`/`members_select_scoped`/`notifications_select_own`),
-- resolves the audience and performs the insert-with-RETURNING entirely
-- inside the function body, and is gated on an explicit
-- `has_permission('communications.notifications.send')` check — the same
-- authorization `notifications_insert_service` RLS already required,
-- just evaluated once, up front, inside the function instead of against
-- every row of an ordinary client-side insert.
-- ============================================================================

create or replace function public.send_notification(
  p_audience text,
  p_department_id uuid,
  p_family_id uuid,
  p_user_ids uuid[],
  p_channel text,
  p_subject text,
  p_body text,
  p_template_id uuid,
  p_triggering_event text,
  p_triggering_record_type text,
  p_triggering_record_id uuid
) returns setof public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_ids uuid[];
begin
  if not public.has_permission('communications.notifications.send') then
    raise exception 'You do not have permission to send notifications' using errcode = '42501';
  end if;

  if p_audience = 'all' then
    select array_agg(u.id) into v_recipient_ids from public.users u where u.is_active = true;
  elsif p_audience = 'department' then
    if p_department_id is null then
      raise exception 'A department is required for this audience' using errcode = '22023';
    end if;
    select array_agg(distinct m.user_id) into v_recipient_ids
    from public.members m
    join public.users u on u.id = m.user_id
    where m.primary_department_id = p_department_id and u.is_active = true;
  elsif p_audience = 'family' then
    if p_family_id is null then
      raise exception 'A family is required for this audience' using errcode = '22023';
    end if;
    select array_agg(distinct m.user_id) into v_recipient_ids
    from public.members m
    join public.users u on u.id = m.user_id
    where m.family_id = p_family_id and u.is_active = true;
  elsif p_audience = 'specific_users' then
    v_recipient_ids := p_user_ids;
  else
    raise exception 'Unknown audience %', p_audience using errcode = '22023';
  end if;

  if v_recipient_ids is null or array_length(v_recipient_ids, 1) is null then
    raise exception 'No recipients matched this audience' using errcode = '22023';
  end if;

  return query
    insert into public.notifications (
      recipient_user_id, template_id, channel, subject, body,
      triggering_event, triggering_record_type, triggering_record_id,
      status, sent_at
    )
    select
      uid, p_template_id, p_channel, p_subject, p_body,
      p_triggering_event, p_triggering_record_type, p_triggering_record_id,
      case when p_channel = 'in_app' then 'sent' else 'queued' end,
      case when p_channel = 'in_app' then now() else null end
    from unnest(v_recipient_ids) as uid
    returning notifications.*;
end;
$$;

comment on function public.send_notification(text, uuid, uuid, uuid[], text, text, text, uuid, text, text, uuid) is
  'The only path that fans a composed notification out to more than the caller''s own row (Phase 10.2) — resolves audience -> recipient_user_ids and inserts one notifications row per recipient inside a SECURITY DEFINER context, so the RLS-scoped read restrictions on users/members and the RETURNING-clause restriction on notifications_select_own (which together made the plain client-side insert non-functional for any non-super_admin sender) never apply to this function''s own internal queries. Authorization is an explicit has_permission(''communications.notifications.send'') check, matching notifications_insert_service RLS''s own requirement exactly.';

-- This phase's own security review noted that Postgres default-grants
-- EXECUTE on a new function to PUBLIC (unlike tables, which default to no
-- access), and that 0024's `alter default privileges ... grant execute on
-- functions to anon, authenticated` means `anon` ends up with EXECUTE here
-- too, regardless of an explicit `revoke ... from public` (tried; `anon`
-- still had it via that separate default-privilege rule, not the PUBLIC
-- grant). This is not a gap unique to this function — it is the identical
-- shape already true of every prior SECURITY DEFINER RPC in this schema
-- (0026, 0028, 0029, 0031) — and it is not independently exploitable: the
-- `has_permission(...)` check above is NULL-safe and correctly refuses any
-- caller (including `anon`, whose `auth.uid()` is always NULL) regardless
-- of who can call the function at all. This mirrors 0024's own stated
-- design principle exactly (broad grants, RLS/permission-check as the
-- actual gate) — deliberately left as-is rather than papered over with a
-- revoke that would not even fully achieve its own goal, and named as a
-- documented, consistent, whole-schema pattern in docs/PHASE_10_2.md §7,
-- not fixed function-by-function here.
grant execute on function public.send_notification(text, uuid, uuid, uuid[], text, text, text, uuid, text, text, uuid) to authenticated;
