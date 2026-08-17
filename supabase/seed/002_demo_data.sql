-- ============================================================================
-- 002_demo_data.sql
-- CLEARLY LABELED DEMO/SAMPLE DATA ONLY (spec S66). Every record is prefixed
-- DEMO_ so it can never be mistaken for a real NGC record, and so it can be
-- deleted with a single `delete ... where name/title/... like 'DEMO_%'`
-- sweep before go-live.
--
-- NEVER load this file into a production database.
--
-- NOTE: This seed inserts directly into auth.users, which only works against
-- our local-development shim (0001_extensions_and_helpers.sql) or the
-- Supabase CLI's local stack. Against a hosted Supabase project, create demo
-- users via the Auth Admin API/dashboard instead — real Supabase's auth.users
-- has additional required plumbing (identities, email confirmation state,
-- etc.) that raw SQL insert does not populate correctly.
-- ============================================================================

do $$
declare
  v_hr_user_id uuid;
  v_member_user_id uuid;
  v_dept_id uuid;
  v_family_id uuid;
  v_member_id uuid;
  v_application_id uuid;
  v_invitation_id uuid;
  v_event_id uuid;
  v_vendor_category_id uuid;
  v_vendor_id uuid;
  v_asset_category_id uuid;
  v_asset_id uuid;
  v_hr_role_id uuid;
  v_member_role_id uuid;
begin
  -- Demo auth users + profiles
  insert into auth.users (email) values ('demo.hr@ngc.co.tz') returning id into v_hr_user_id;
  insert into auth.users (email) values ('demo.member@ngc.co.tz') returning id into v_member_user_id;

  insert into public.users (id, email, display_name) values
    (v_hr_user_id, 'demo.hr@ngc.co.tz', 'DEMO_HR Officer'),
    (v_member_user_id, 'demo.member@ngc.co.tz', 'DEMO_Choir Member');

  select id into v_hr_role_id from public.roles where code = 'hr_deputy_secretary';
  select id into v_member_role_id from public.roles where code = 'choir_member';
  insert into public.user_roles (user_id, role_id) values
    (v_hr_user_id, v_hr_role_id),
    (v_member_user_id, v_member_role_id);

  -- Demo department & family
  insert into public.departments (name, description, leader_user_id)
    values ('DEMO_Sopranos Department', 'Demo department for testing', v_hr_user_id)
    returning id into v_dept_id;
  insert into public.families (name, description, leader_user_id)
    values ('DEMO_Grace Family', 'Demo family for testing', v_hr_user_id)
    returning id into v_family_id;

  -- Demo application -> approved -> converted to member
  insert into public.applications (
    application_number, application_type, access_token_hash, verification_contact,
    submitted_data, status, completion_percentage, reviewed_by, reviewed_at, decision_reason, submitted_at
  ) values (
    public.next_formatted_id('application_number', 'APP-{year}-{sequence}'),
    'new_member',
    'demo-token-hash-not-real',
    'demo.applicant@example.com',
    '{"personal": {"first_name": "DEMO", "last_name": "Applicant"}}'::jsonb,
    'converted_to_member',
    100,
    v_hr_user_id,
    now(),
    'DEMO_Meets all onboarding criteria.',
    now()
  ) returning id into v_application_id;

  insert into public.members (
    member_number, user_id, application_id, first_name, last_name, gender,
    email, primary_department_id, family_id, membership_status, joined_at
  ) values (
    public.next_formatted_id('member_number', 'NGC-{year}-{sequence}'),
    v_member_user_id,
    v_application_id,
    'DEMO_Grace', 'DEMO_Mwangaza', 'female',
    'demo.member@ngc.co.tz', v_dept_id, v_family_id, 'active', current_date
  ) returning id into v_member_id;

  update public.applications set existing_member_id = null where id = v_application_id;

  insert into public.probation (member_id, application_id, duration_days, deadline, assigned_department_id, assigned_family_id, responsible_leader_id, status, decided_by, decided_at)
  values (v_member_id, v_application_id, 90, current_date + interval '90 days', v_dept_id, v_family_id, v_hr_user_id, 'completed', v_hr_user_id, now());

  -- Demo attendance session + record
  insert into public.attendance_sessions (session_type, title, department_id, session_date, created_by)
  select 'rehearsal', 'DEMO_Weekly Rehearsal', v_dept_id, current_date, v_hr_user_id;

  insert into public.attendance (session_id, member_id, status_code, recorded_by)
  select s.id, v_member_id, 'present', v_hr_user_id
  from public.attendance_sessions s where s.title = 'DEMO_Weekly Rehearsal';

  -- Demo invitation -> event
  insert into public.invitations (
    invitation_number, organizer_name, organizer_contact_email, event_name, event_type,
    proposed_date, venue, location, access_token_hash, verification_contact, status, submitted_at
  ) values (
    public.next_formatted_id('invitation_number', 'INV-{year}-{sequence}'),
    'DEMO_Community Church Dar es Salaam', 'demo.organizer@example.com', 'DEMO_Sunday Worship Concert', 'worship_service',
    current_date + interval '30 days', 'DEMO_Community Hall', 'Dar es Salaam', 'demo-token-hash-not-real',
    'demo.organizer@example.com', 'approved', now()
  ) returning id into v_invitation_id;

  insert into public.events (invitation_id, name, event_category, event_date, venue, location, status)
  values (v_invitation_id, 'DEMO_Sunday Worship Concert', 'invitation', current_date + interval '30 days', 'DEMO_Community Hall', 'Dar es Salaam', 'confirmed')
  returning id into v_event_id;

  insert into public.event_participants (event_id, member_id, assignment_source)
  values (v_event_id, v_member_id, 'manual');

  -- Demo vendor
  select id into v_vendor_category_id from public.vendor_categories where name = 'Transport';
  insert into public.vendors (name, category_id, contact_person, phone, status)
  values ('DEMO_Safari Coach Transport', v_vendor_category_id, 'DEMO_Contact Person', '+255700000000', 'active')
  returning id into v_vendor_id;

  -- Demo asset
  select id into v_asset_category_id from public.asset_categories where name = 'Audio Equipment';
  insert into public.assets (asset_tag, category_id, name, serial_number, condition, availability_status)
  values ('DEMO-AST-0001', v_asset_category_id, 'DEMO_Wireless Microphone Set', 'DEMO-SN-0001', 'good', 'available')
  returning id into v_asset_id;

  -- Demo contribution campaign + record
  insert into public.contribution_campaigns (name, description, target_amount, deadline, status, created_by)
  values ('DEMO_Grace Unlimited Event', 'Demo campaign for testing dashboards', 5000000, current_date + interval '60 days', 'active', v_hr_user_id);

  insert into public.contribution_records (campaign_id, member_id, amount, payment_method, status, recorded_by)
  select c.id, v_member_id, 50000, 'mobile_money', 'confirmed', v_hr_user_id
  from public.contribution_campaigns c where c.name = 'DEMO_Grace Unlimited Event';

  -- Demo announcement
  insert into public.announcements (title, message, target_audience, author_id)
  values ('DEMO_Welcome Announcement', 'This is a demo announcement for testing the Communications module.', 'all', v_hr_user_id);

  raise notice 'DEMO seed data loaded: department=%, family=%, member=%, invitation=%, event=%, vendor=%, asset=%',
    v_dept_id, v_family_id, v_member_id, v_invitation_id, v_event_id, v_vendor_id, v_asset_id;
end
$$;
