-- ============================================================================
-- 001_reference_data.sql
-- Reference/configuration seed data: roles, permissions, role-permission
-- grants, lookup values, category registries, system settings defaults,
-- notification templates, and default workflow definitions.
--
-- This is REAL configuration the application needs to boot with a working
-- RBAC model and sensible defaults — NOT demo/sample business records. Demo
-- business records (a sample member, invitation, vendor, asset, etc., all
-- clearly prefixed DEMO_) live in 002_demo_data.sql and must never be loaded
-- into a production database (spec S66).
-- ============================================================================

-- --------------------------------------------------------------------------
-- Roles
-- --------------------------------------------------------------------------
insert into public.roles (code, name, description, is_system_role) values
  ('super_admin',         'Super Administrator',        'Full system configuration and access', true),
  ('chairman',            'Chairman',                   'Top institutional approvals and oversight', true),
  ('vice_chairman',       'Vice Chairman',               'Delegated management approvals', true),
  ('secretary',           'Secretary',                   'Institutional administration and major approvals', true),
  ('hr_deputy_secretary', 'Deputy Secretary / HR',       'Member lifecycle, attendance, leave, onboarding', true),
  ('technical_manager',   'Technical Manager / Director','Technical riders, equipment, gate passes, playlists', true),
  ('finance_manager',     'Finance Manager',             'Contributions, expenses, vendors, financial reports', true),
  ('discipline_manager',  'Discipline Manager',          'Disciplinary cases and actions (confidential)', true),
  ('pro_spokesperson',    'PRO / Spokesperson',          'Communications, announcements, public information', true),
  ('logistics_officer',   'Logistics Officer',           'Transportation, vendors, itineraries', true),
  ('inventory_officer',   'Inventory Officer',           'Assets, equipment, stock, gate passes', true),
  ('media_department',    'Media Department',            'Media links and event media management', true),
  ('department_leader',   'Department Leader',           'Manage assigned department (scoped grant)', true),
  ('family_leader',       'Family Leader',                'Manage assigned family (scoped grant)', true),
  ('choir_member',        'Choir Member',                 'Self-service member access', true);

-- --------------------------------------------------------------------------
-- Permissions (module.resource.action)
-- --------------------------------------------------------------------------
insert into public.permissions (code, module, resource, action, description) values
  ('admin.users.read',                 'admin',          'users',                'read',    'Read user accounts'),
  ('admin.users.update',                'admin',          'users',                'update',  'Update user accounts'),
  ('admin.users.manage',                'admin',          'users',                'manage',  'Full user account management incl. role assignment'),
  ('admin.roles.manage',                'admin',          'roles',                'manage',  'Manage roles and permission grants'),
  ('admin.departments.manage',          'admin',          'departments',          'manage',  'Manage department registry'),
  ('admin.families.manage',             'admin',          'families',             'manage',  'Manage family registry'),
  ('admin.settings.manage',             'admin',          'settings',             'manage',  'Manage system settings and lookup values'),
  ('admin.workflows.manage',            'admin',          'workflows',            'manage',  'Manage configurable approval workflows'),
  ('admin.audit_log.read',              'admin',          'audit_log',            'read',    'Read the audit log'),

  ('members.profiles.read_all',         'members',        'profiles',             'read',    'Read all member profiles'),
  ('members.profiles.manage',           'members',        'profiles',             'manage',  'Create/update/archive member profiles and assignments'),
  ('members.applications.read',         'members',        'applications',         'read',    'Read applications'),
  ('members.applications.manage',       'members',        'applications',         'manage',  'Review/approve/reject applications, manage probation'),

  ('attendance.records.read_all',       'attendance',      'records',              'read',    'Read all attendance records'),
  ('attendance.records.manage',         'attendance',      'records',              'manage',  'Record/edit attendance'),
  ('attendance.leave.manage',           'attendance',      'leave',                'manage',  'Approve/reject leave requests'),

  ('discipline.cases.read',             'discipline',      'cases',                'read',    'Read disciplinary cases and actions'),
  ('discipline.cases.manage',           'discipline',      'cases',                'manage',  'Create/update disciplinary cases and actions'),

  ('events.invitations.read',           'events',          'invitations',          'read',    'Read invitations/events'),
  ('events.invitations.manage',         'events',          'invitations',          'manage',  'Manage invitations/events end to end'),
  ('events.eligibility.manage',         'events',          'eligibility',          'manage',  'Manage event participant eligibility and overrides'),

  ('technical.riders.manage',           'technical',       'riders',               'manage',  'Manage technical riders'),
  ('technical.playlists.manage',        'technical',       'playlists',            'manage',  'Manage playlists'),
  ('technical.events.manage',           'technical',       'events',               'manage',  'Technical Department event management access'),
  ('technical.equipment.assign',        'technical',       'equipment',            'assign',  'Assign equipment to events, request gate passes'),

  ('inventory.categories.manage',       'inventory',       'categories',           'manage',  'Manage asset categories'),
  ('inventory.assets.manage',           'inventory',       'assets',               'manage',  'Manage asset registry and assignments'),
  ('inventory.gate_passes.manage',      'inventory',       'gate_passes',          'manage',  'Create/approve gate passes'),
  ('inventory.gate_passes.read',        'inventory',       'gate_passes',          'read',    'Read gate passes'),

  ('uniform.inventory.manage',          'uniform',         'inventory',            'manage',  'Manage uniform inventory and assignments'),

  ('logistics.vendors.manage',          'logistics',       'vendors',              'manage',  'Manage logistics vendor categories/registry'),
  ('logistics.trips.manage',            'logistics',       'trips',                'manage',  'Manage trips and itineraries'),

  ('finance.vendors.manage',            'finance',         'vendors',              'manage',  'Manage vendor financial/payment records'),
  ('finance.contributions.manage',      'finance',         'contributions',        'manage',  'Manage contribution campaigns and records'),
  ('finance.contributions.read',        'finance',         'contributions',        'read',    'Read contribution summaries'),
  ('finance.expenses.manage',           'finance',         'expenses',             'manage',  'Manage expense requests'),
  ('finance.expenses.approve',          'finance',         'expenses',             'approve', 'Approve/reject expense requests'),
  ('finance.procurement.manage',        'finance',         'procurement',          'manage',  'Manage procurement requests and purchase orders'),

  ('documents.categories.manage',       'documents',       'categories',           'manage',  'Manage document categories'),
  ('documents.manage',                  'documents',       'documents',            'manage',  'Manage (non-confidential) documents platform-wide'),
  ('documents.read_all',                'documents',       'documents',            'read',    'Read all (non-confidential) documents'),

  ('communications.templates.manage',   'communications',  'templates',            'manage',  'Manage notification templates'),
  ('communications.notifications.read_all', 'communications', 'notifications',    'read',    'Read all notifications (support/debug)'),
  ('communications.notifications.send', 'communications',  'notifications',       'send',    'Trigger/send notifications'),
  ('communications.announcements.manage', 'communications', 'announcements',      'manage',  'Manage announcements'),

  ('media.links.manage',                'media',           'links',                'manage',  'Manage media links/content'),

  ('management.agenda.manage',          'management',      'agenda',               'manage',  'Create agenda items, view vote integrity data'),
  ('management.approvals.read_all',     'management',      'approvals',            'read',    'Read all pending approvals across modules (Approval Center)'),
  ('management.approvals.manage',       'management',      'approvals',            'manage',  'Advance/record approval decisions on behalf of the workflow engine');

-- --------------------------------------------------------------------------
-- Role -> Permission grants
-- --------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'super_admin'; -- Super Admin holds every permission

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'hr_deputy_secretary' and p.code in (
  'members.profiles.read_all','members.profiles.manage','members.applications.read','members.applications.manage',
  'attendance.records.read_all','attendance.records.manage','attendance.leave.manage',
  'events.invitations.read','communications.announcements.manage','management.approvals.read_all',
  -- Phase 9.1 addition: PRD §6's Permission Matrix names HR/Deputy Secretary
  -- as "Read (summary)" on Contributions; the permission code itself
  -- (`finance.contributions.read`) already existed since Phase 4 but was
  -- never granted to this role — the same shape of pre-existing seed-vs-PRD
  -- gap Phase 8.1 corrected for `logistics_officer`/`finance.vendors.manage`
  -- (docs/PHASE_8_1.md §2.1). This grant only widens HR's read access to
  -- contribution summaries/records (`contribution_records_select_scoped`,
  -- `contribution_campaigns_select_internal` RLS, 0014) — no write access.
  'finance.contributions.read'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'technical_manager' and p.code in (
  'technical.riders.manage','technical.playlists.manage','technical.events.manage','technical.equipment.assign',
  'inventory.assets.manage','inventory.gate_passes.manage','inventory.gate_passes.read',
  'events.invitations.read','events.eligibility.manage','management.approvals.read_all'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'finance_manager' and p.code in (
  'finance.vendors.manage','finance.contributions.manage','finance.contributions.read',
  'finance.expenses.manage','finance.expenses.approve','finance.procurement.manage',
  'events.invitations.read','management.approvals.read_all'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'discipline_manager' and p.code in ('discipline.cases.read','discipline.cases.manage');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'pro_spokesperson' and p.code in (
  'communications.announcements.manage','communications.templates.manage','media.links.manage',
  -- Phase 10.2 addition: PRD §5's Role Summary names PRO/Spokesperson as
  -- "Full Communications + Announcements" — the permission code itself
  -- (`communications.notifications.send`) already existed since Phase 4
  -- but was never granted to this role (only Super Admin held it), the
  -- same shape of pre-existing seed-vs-PRD gap Phase 8.1 corrected for
  -- `logistics_officer`/`finance.vendors.manage` and Phase 9.1 corrected
  -- for `hr_deputy_secretary`/`finance.contributions.read`. Without this
  -- grant, the one role PRD explicitly names as owning Communications
  -- could manage templates and announcements but could never actually
  -- send a notification through the composer this phase builds.
  'communications.notifications.send'
);

-- `finance.vendors.manage` is deliberately NOT granted here (it was in the
-- original Phase 4 seed, and got removed in Phase 8.1 once a real reader
-- of the distinction existed): 0013_vendors_logistics.sql's own column
-- comment on `bank_payment_information` says "Logistics sees vendor
-- contact but not banking details" — granting both permissions to the
-- same role made that masking a no-op for the exact role it names, since
-- `finance.vendors.manage` is what packages/services/src/vendors read-side
-- masking (list.ts/map.ts) treats as "may see tax/bank fields." Logistics
-- still fully manages the vendor registry via `logistics.vendors.manage`
-- alone (RLS grants either permission full row access) — only the
-- financial-field visibility distinction changes.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'logistics_officer' and p.code in ('logistics.vendors.manage','logistics.trips.manage');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'inventory_officer' and p.code in (
  'inventory.categories.manage','inventory.assets.manage','inventory.gate_passes.manage','inventory.gate_passes.read'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'media_department' and p.code in ('media.links.manage','events.invitations.read');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code = 'secretary' and p.code in (
  'members.applications.read','members.applications.manage','events.invitations.read','events.invitations.manage',
  'inventory.gate_passes.read','management.approvals.read_all','management.approvals.manage',
  'management.agenda.manage','admin.audit_log.read','documents.read_all'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.code in ('chairman','vice_chairman') and p.code in (
  'events.invitations.read','management.approvals.read_all','management.approvals.manage',
  'management.agenda.manage','finance.expenses.approve'
);

-- Department/Family Leader and Choir Member intentionally receive NO global
-- permission rows here — their access is either self-scoped (checked via
-- user_id = auth.uid() in each table's RLS policy, no permission needed) or
-- scope-granted per-department/family via user_roles.scope_type/scope_id
-- (see 0002_rbac.sql current_user_department_ids()/current_user_family_ids()),
-- assigned per person by Super Admin/Secretary, not baked into the role here.

-- --------------------------------------------------------------------------
-- Lookup values (admin-editable categories/statuses — spec S60)
-- --------------------------------------------------------------------------
insert into public.lookup_values (category, code, label, sort_order, metadata) values
  ('attendance_status', 'present',         'Present',         1, '{"counts_as_present": true}'),
  ('attendance_status', 'late',            'Late',            2, '{"counts_as_present": true}'),
  ('attendance_status', 'absent',          'Absent',          3, '{"counts_as_present": false}'),
  ('attendance_status', 'excused',         'Excused',         4, '{"counts_as_present": false}'),
  ('attendance_status', 'emergency_leave', 'Emergency Leave', 5, '{"counts_as_present": false}'),
  ('attendance_status', 'approved_leave',  'Approved Leave',  6, '{"counts_as_present": false}');

insert into public.lookup_values (category, code, label, sort_order) values
  ('expense_category', 'transport',    'Transport', 1),
  ('expense_category', 'equipment',    'Equipment', 2),
  ('expense_category', 'catering',     'Catering', 3),
  ('expense_category', 'printing',     'Printing', 4),
  ('expense_category', 'accommodation','Accommodation', 5),
  ('expense_category', 'other',        'Other', 6);

insert into public.lookup_values (category, code, label, sort_order) values
  ('uniform_category', 'choir_robe',   'Choir Robe', 1),
  ('uniform_category', 't_shirt',      'T-Shirt', 2),
  ('uniform_category', 'scarf',        'Scarf', 3),
  ('uniform_category', 'other',        'Other', 4);

insert into public.lookup_values (category, code, label, sort_order) values
  ('payment_method', 'cash',           'Cash', 1),
  ('payment_method', 'mobile_money',   'Mobile Money', 2),
  ('payment_method', 'bank_transfer',  'Bank Transfer', 3),
  ('payment_method', 'other',          'Other', 4);

insert into public.lookup_values (category, code, label, sort_order) values
  ('vocal_category', 'soprano', 'Soprano', 1),
  ('vocal_category', 'alto',    'Alto', 2),
  ('vocal_category', 'tenor',   'Tenor', 3),
  ('vocal_category', 'bass',    'Bass', 4);

insert into public.lookup_values (category, code, label, sort_order) values
  ('discipline_category', 'conduct',      'Conduct', 1),
  ('discipline_category', 'attendance',   'Attendance-related', 2),
  ('discipline_category', 'financial',    'Financial', 3),
  ('discipline_category', 'other',        'Other', 4);

insert into public.lookup_values (category, code, label, sort_order) values
  ('event_type', 'worship_service',  'Worship Service', 1),
  ('event_type', 'concert',          'Concert', 2),
  ('event_type', 'crusade',          'Crusade', 3),
  ('event_type', 'wedding',          'Wedding', 4),
  ('event_type', 'funeral',          'Funeral/Memorial', 5),
  ('event_type', 'tv_recording',     'TV Recording (Worship in Spirit)', 6),
  ('event_type', 'other',            'Other', 7);

-- --------------------------------------------------------------------------
-- Category registries with dedicated tables
-- --------------------------------------------------------------------------
insert into public.document_categories (name, is_confidential) values
  ('Member', false), ('HR', false), ('Financial', false), ('Event', false),
  ('Technical', false), ('Logistics', false), ('Legal', false), ('Church', false),
  ('Constitution', false), ('Policy', false), ('Report', false), ('Contract', false),
  ('Media', false), ('Administrative', false), ('Discipline', true);

insert into public.vendor_categories (name) values
  ('Transport'), ('Uniform Tailor'), ('Equipment'), ('Accommodation'), ('Catering'), ('Printing'), ('Other');

insert into public.asset_categories (name) values
  ('Audio Equipment'), ('Cameras'), ('Lighting'), ('LED/Display Equipment'), ('Musical Instruments'),
  ('Computers'), ('Networking Equipment'), ('Furniture'), ('Transportation Equipment'),
  ('Production Equipment'), ('Other Assets');

-- --------------------------------------------------------------------------
-- System settings defaults (illustrative — confirm real values with NGC
-- leadership before go-live; see PRD.md S14 / ARCHITECTURE.md S21)
-- --------------------------------------------------------------------------
insert into public.system_settings (setting_key, value, value_type, description) values
  ('attendance.eligibility_threshold_percent', '70', 'number', 'Minimum attendance % for event eligibility (spec S25/S26)'),
  ('probation.default_duration_days', '90', 'number', 'Default probation length in days (placeholder — confirm with HR)'),
  ('applications.processing_days_min', '7', 'number', 'Displayed (non-binding) minimum processing days'),
  ('applications.processing_days_max', '21', 'number', 'Displayed (non-binding) maximum processing days'),
  ('members.inactivity_window_days', '90', 'number', 'Consecutive days with no recorded activity before "Potentially Inactive" flag (spec S28)'),
  ('id_format.member_number', '"NGC-{year}-{sequence}"', 'string', 'Member ID format template'),
  ('id_format.application_number', '"APP-{year}-{sequence}"', 'string', 'Application number format template'),
  ('id_format.invitation_number', '"INV-{year}-{sequence}"', 'string', 'Invitation number format template'),
  ('id_format.gate_pass_number', '"GP-{year}-{sequence}"', 'string', 'Gate pass number format template'),
  ('id_format.asset_tag', '"AST-{year}-{sequence}"', 'string', 'Asset tag format template'),
  ('id_format.disciplinary_case_number', '"DISC-{year}-{sequence}"', 'string', 'Disciplinary case number format template'),
  ('id_format.expense_request_number', '"EXP-{year}-{sequence}"', 'string', 'Expense request number format template'),
  ('organization.name', '"Neema Gospel Choir"', 'string', 'Organization display name'),
  ('organization.founded_date', '"1992-06-12"', 'string', 'Founding date'),
  ('organization.base_location', '"AICT Chang''ombe Church, Dar es Salaam"', 'string', 'Base location'),
  ('notifications.whatsapp_enabled', 'false', 'boolean', 'Toggled true only once an approved WhatsApp Business provider is configured (spec S36)'),
  ('notifications.sms_enabled', 'false', 'boolean', 'Toggled true only once an SMS provider is configured');

-- --------------------------------------------------------------------------
-- Notification templates (spec S36 examples)
-- --------------------------------------------------------------------------
insert into public.notification_templates (code, name, channel_subject, body_template, default_channels) values
  ('rehearsal_reminder',    'Rehearsal Reminder',     'Rehearsal Reminder',      'Reminder: {{session_title}} on {{session_date}} at {{start_time}}.', '{in_app,push}'),
  ('event_reminder',        'Event Reminder',          'Upcoming Event',          'Reminder: {{event_name}} on {{event_date}} at {{venue}}.', '{in_app,push,email}'),
  ('contribution_reminder', 'Contribution Reminder',   'Contribution Reminder',   'The "{{campaign_name}}" contribution deadline is {{deadline}}. Outstanding: {{outstanding_amount}}.', '{in_app,push}'),
  ('attendance_warning',    'Attendance Warning',      'Attendance Below Threshold', 'Your attendance is currently {{attendance_percentage}}%, below the {{threshold}}% eligibility threshold.', '{in_app,push}'),
  ('birthday_message',      'Birthday Message',        'Happy Birthday!',         'Happy birthday, {{first_name}}! From all of us at Neema Gospel Choir.', '{in_app,push}'),
  ('announcement',          'Announcement',            '{{announcement_title}}', '{{announcement_message}}', '{in_app,push}'),
  ('emergency_notification','Emergency Notification',  'URGENT: {{title}}',       '{{message}}', '{in_app,push,sms}');

-- --------------------------------------------------------------------------
-- Default configurable approval workflows (spec S21, S31, S17)
-- --------------------------------------------------------------------------
insert into public.workflow_definitions (record_type, name) values
  ('invitation', 'Standard Invitation Approval'),
  ('expense_request', 'Standard Expense Approval'),
  ('gate_pass', 'Standard Gate Pass Approval');

insert into public.workflow_definition_steps (workflow_definition_id, step_order, required_role_code)
select id, 1, 'secretary' from public.workflow_definitions where record_type = 'invitation'
union all
select id, 2, 'technical_manager' from public.workflow_definitions where record_type = 'invitation'
union all
select id, 3, 'finance_manager' from public.workflow_definitions where record_type = 'invitation'
union all
select id, 4, 'chairman' from public.workflow_definitions where record_type = 'invitation';

insert into public.workflow_definition_steps (workflow_definition_id, step_order, required_role_code)
select id, 1, 'finance_manager' from public.workflow_definitions where record_type = 'expense_request'
union all
select id, 2, 'secretary' from public.workflow_definitions where record_type = 'expense_request'
union all
select id, 3, 'chairman' from public.workflow_definitions where record_type = 'expense_request';

insert into public.workflow_definition_steps (workflow_definition_id, step_order, required_role_code)
select id, 1, 'technical_manager' from public.workflow_definitions where record_type = 'gate_pass'
union all
select id, 2, 'secretary' from public.workflow_definitions where record_type = 'gate_pass';
