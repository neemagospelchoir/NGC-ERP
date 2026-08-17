-- ============================================================================
-- 0041_username_and_self_signup.sql
-- Adds an optional `username` column to public.users, plus a trigger on
-- auth.users that auto-provisions the matching public.users profile row and
-- a default `choir_member` role for every NEW Supabase Auth account —
-- whether that account was created through the new self-service /signup
-- form (apps/web/app/signup) or by an admin via the Supabase dashboard's
-- "Add user" button (the manual flow used before this migration existed).
--
-- This is intentionally the ONLY place a role is auto-assigned, and it only
-- ever assigns `choir_member` (the lowest-privilege role in
-- 001_reference_data.sql's catalog) — a public sign-up form must never be
-- able to self-escalate to a staff role. An admin still upgrades someone
-- afterward with a normal `insert into public.user_roles ...` for the
-- higher role code, exactly as before.
--
-- Safe to run on a database that already has hand-created users: every
-- insert here is guarded (ON CONFLICT / NOT EXISTS) so it never overwrites
-- or duplicates a profile/role an admin already set up by hand.
-- ============================================================================

alter table public.users add column if not exists username citext unique;

comment on column public.users.username is
  'Optional unique handle a member can sign in with instead of their email (see resolveLoginIdentifier in packages/services/src/auth). Set at self-signup from auth.users.raw_user_meta_data ->> ''username'', or later by an admin.';

create or replace function public.handle_new_auth_user() returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $$
declare
  v_choir_member_role_id uuid;
begin
  -- Create the public profile row. display_name/username come from the
  -- signup form's metadata (see packages/services/src/auth/sign-up.ts) when
  -- present; falling back to the email's local-part keeps this safe for
  -- accounts created another way (e.g. the Supabase dashboard's "Add user"
  -- button, which sets no metadata at all), since display_name is NOT NULL.
  insert into public.users (id, email, display_name, username)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'username', '')
  )
  on conflict (id) do nothing;

  -- Default every new account to the ordinary member role only. Never
  -- touches user_roles for an account that already has ANY role (e.g. an
  -- admin who assigned a staff role in the same transaction some other way)
  -- so this can't downgrade or duplicate an existing grant.
  select id into v_choir_member_role_id from public.roles where code = 'choir_member';

  if v_choir_member_role_id is not null and not exists (
    select 1 from public.user_roles where user_id = new.id
  ) then
    insert into public.user_roles (user_id, role_id)
    values (new.id, v_choir_member_role_id);
  end if;

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Trigger target for auth.users AFTER INSERT — auto-provisions the matching public.users row and a default choir_member role for every new Supabase Auth account, whether created via /signup or the Supabase dashboard. See this file''s header comment for the full rationale.';

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
