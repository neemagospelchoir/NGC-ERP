import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 7.3 (Attendance & Leave) end-to-end verification — same real-
 * server/real-mock harness as auth.spec.ts/directory.spec.ts/onboarding.spec.ts.
 *
 * Four signed-in identities:
 *   - HR_USER holds `attendance.records.manage`, `attendance.records.read_all`,
 *     and `attendance.leave.manage` — can create/mark any session and
 *     decide any leave request.
 *   - LEADER_USER holds a department-SCOPED role (scope_type='department',
 *     scope_id=dept-1) and NO global attendance permission — exercises the
 *     "department leader" path: can create/mark a session scoped to their
 *     own department, but not a whole-choir session or another
 *     department's.
 *   - MEMBER_USER is a plain signed-in member (own `members` row, no
 *     special permissions) — exercises "member requests their own leave"
 *     and "member sees their own attendance %."
 *   - A second member (member-e2e-other) exists with its own leave request
 *     to verify MEMBER_USER cannot see it in their own "Leave" list.
 */
const HR_USER: MockUser = {
  id: "user-hr-3",
  email: "hr-attendance@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Faraja HR",
};

const LEADER_USER: MockUser = {
  id: "user-leader-1",
  email: "leader@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Dotto Leader",
};

const MEMBER_USER: MockUser = {
  id: "user-member-3",
  email: "member-attendance@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Neema Member",
};

const SEED_DATA = {
  users: [
    { id: HR_USER.id, email: HR_USER.email, display_name: HR_USER.displayName, is_active: true },
    { id: LEADER_USER.id, email: LEADER_USER.email, display_name: LEADER_USER.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  departments: [
    { id: "dept-1", name: "Sopranos", description: null, is_active: true },
    { id: "dept-2", name: "Altos", description: null, is_active: true },
  ],
  members: [
    {
      id: "member-e2e-att-1",
      user_id: MEMBER_USER.id,
      member_number: "NGC-2026-0201",
      first_name: "Neema",
      last_name: "Member",
      preferred_name: null,
      membership_status: "active",
      primary_department_id: "dept-1",
      family_id: null,
      phone: "0700555111",
      email: MEMBER_USER.email,
      qr_token: "qr-att-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "member-e2e-att-2",
      user_id: null,
      member_number: "NGC-2026-0202",
      first_name: "Baraka",
      last_name: "Other",
      preferred_name: null,
      membership_status: "active",
      primary_department_id: "dept-2",
      family_id: null,
      phone: "0700555222",
      email: "baraka.other@ngc.org",
      qr_token: "qr-att-2",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "member-e2e-att-exited",
      user_id: null,
      member_number: "NGC-2026-0203",
      first_name: "Zena",
      last_name: "Exited",
      preferred_name: null,
      membership_status: "exited",
      primary_department_id: "dept-1",
      family_id: null,
      phone: "0700555333",
      email: "zena.exited@ngc.org",
      qr_token: "qr-att-3",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  user_roles: [
    { user_id: HR_USER.id, role_id: "role-hr-att", scope_type: null, scope_id: null, revoked_at: null },
    { user_id: LEADER_USER.id, role_id: "role-leader-att", scope_type: "department", scope_id: "dept-1", revoked_at: null },
  ],
  roles: [
    { id: "role-hr-att", code: "hr_deputy_secretary", name: "HR Deputy Secretary" },
    { id: "role-leader-att", code: "department_leader", name: "Department Leader" },
  ],
  role_permissions: [
    { role_id: "role-hr-att", permission_id: "perm-att-manage" },
    { role_id: "role-hr-att", permission_id: "perm-att-read-all" },
    { role_id: "role-hr-att", permission_id: "perm-leave-manage" },
  ],
  permissions: [
    { id: "perm-att-manage", code: "attendance.records.manage" },
    { id: "perm-att-read-all", code: "attendance.records.read_all" },
    { id: "perm-leave-manage", code: "attendance.leave.manage" },
  ],
  lookup_values: [
    { id: "lv-present", category: "attendance_status", code: "present", label: "Present", sort_order: 1, is_active: true, metadata: { counts_as_present: true } },
    { id: "lv-absent", category: "attendance_status", code: "absent", label: "Absent", sort_order: 2, is_active: true, metadata: { counts_as_present: false } },
    { id: "lv-late", category: "attendance_status", code: "late", label: "Late", sort_order: 3, is_active: true, metadata: { counts_as_present: true } },
  ],
  attendance_sessions: [
    {
      id: "session-choir-1",
      session_type: "rehearsal",
      title: "Whole-choir rehearsal",
      department_id: null,
      event_id: null,
      session_date: "2026-01-10",
      starts_at: null,
      ends_at: null,
      created_by: HR_USER.id,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "session-dept-1",
      session_type: "department_meeting",
      title: "Sopranos section practice",
      department_id: "dept-1",
      event_id: null,
      session_date: "2026-01-12",
      starts_at: null,
      ends_at: null,
      created_by: HR_USER.id,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  attendance: [
    {
      id: "att-1",
      session_id: "session-dept-1",
      member_id: "member-e2e-att-1",
      status_code: "present",
      recorded_via: "manual",
      recorded_by: HR_USER.id,
      client_idempotency_key: null,
      notes: null,
      created_at: "2026-01-12T00:00:00.000Z",
      updated_at: "2026-01-12T00:00:00.000Z",
    },
  ],
  member_attendance_summary: [{ member_id: "member-e2e-att-1", sessions_present: 1, sessions_recorded: 1, attendance_percentage: 100 }],
  leave_requests: [
    {
      id: "leave-other-1",
      member_id: "member-e2e-att-2",
      leave_type: "emergency",
      reason: "Family emergency",
      start_date: "2026-02-01",
      end_date: "2026-02-02",
      status: "pending",
      approved_by: null,
      approved_at: null,
      approver_comment: null,
      created_at: "2026-01-20T00:00:00.000Z",
      updated_at: "2026-01-20T00:00:00.000Z",
    },
  ],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 7.3 attendance & leave", () => {
  test.beforeEach(async () => {
    await seedMockServer([HR_USER, LEADER_USER, MEMBER_USER], SEED_DATA);
  });

  test("HR creates a whole-choir session and marks a member present", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/attendance/new");
    await page.getByLabel("Title").fill("Special whole-choir rehearsal");
    await page.getByLabel("Session date").fill("2026-01-15");
    await page.getByRole("button", { name: "Create session" }).click();

    await expect(page).toHaveURL(/\/attendance\/.+/);
    await expect(page.getByRole("heading", { name: "Special whole-choir rehearsal" })).toBeVisible();

    // Whole-choir roster excludes the exited member.
    await expect(page.getByText("Zena Exited")).toHaveCount(0);
    await expect(page.getByText("Neema Member")).toBeVisible();
    await expect(page.getByText("Baraka Other")).toBeVisible();

    const row = page.locator("tr", { hasText: "Neema Member" });
    await row.locator("select[name='statusCode']").selectOption("late");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(row.locator(".rounded-pill")).toContainText("Late");
  });

  test("a department-scoped session's roster only includes that department's non-exited members", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/attendance/session-dept-1");
    await expect(page.getByText("Neema Member")).toBeVisible();
    await expect(page.getByText("Baraka Other")).toHaveCount(0);
    await expect(page.getByText("Zena Exited")).toHaveCount(0);

    // Already-recorded attendance shows as a status pill, not "Not marked".
    const row = page.locator("tr", { hasText: "Neema Member" });
    await expect(row.locator(".rounded-pill")).toContainText("Present");
  });

  test("a department-scoped leader can create and mark attendance for their own department", async ({ page }) => {
    await signIn(page, LEADER_USER);
    await page.goto("/attendance");
    await expect(page.getByRole("link", { name: "New session" })).toBeVisible();

    await page.goto("/attendance/new");
    await page.getByLabel("Title").fill("Sopranos extra practice");
    await page.getByLabel("Department").selectOption({ label: "Sopranos" });
    await page.getByLabel("Session date").fill("2026-01-20");
    await page.getByRole("button", { name: "Create session" }).click();

    await expect(page).toHaveURL(/\/attendance\/.+/);
    await expect(page.getByText("Neema Member")).toBeVisible();
    const row = page.locator("tr", { hasText: "Neema Member" });
    await row.locator("select[name='statusCode']").selectOption("present");
    await row.getByRole("button", { name: "Save" }).click();
    await expect(row.locator(".rounded-pill")).toContainText("Present");
  });

  test("a department-scoped leader cannot manage a whole-choir session", async ({ page }) => {
    await signIn(page, LEADER_USER);
    await page.goto("/attendance/session-choir-1");
    await expect(page.getByText("You don't have permission to mark attendance for this session.")).toBeVisible();
    await expect(page.locator("select[name='statusCode']")).toHaveCount(0);
  });

  test("a member submits a leave request and HR approves it with a comment", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/leave/new");
    await page.getByLabel("Start date").fill("2026-03-01");
    await page.getByLabel("End date").fill("2026-03-03");
    await page.getByLabel("Reason").fill("Family event out of town");
    await page.getByRole("button", { name: "Submit request" }).click();

    await expect(page).toHaveURL(/\/leave\/.+/);
    await expect(page.getByText("Pending").first()).toBeVisible();

    // Switching signed-in identity mid-test — /login redirects an
    // already-authenticated session straight to /dashboard, so the
    // credential form never re-appears unless the session cookie is
    // cleared first (see onboarding.spec.ts's "resubmit" test for the
    // same pattern).
    await page.context().clearCookies();
    await signIn(page, HR_USER);
    await page.goto("/leave");
    await page.getByRole("link", { name: "Neema Member" }).click();
    const approveForm = page.locator("form", { has: page.getByRole("button", { name: "Approve" }) });
    await approveForm.getByLabel("Comment").fill("Approved, enjoy the trip.");
    await approveForm.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved").first()).toBeVisible();
    await expect(page.getByText("Approved, enjoy the trip.")).toBeVisible();
  });

  test("a member sees only their own leave requests, and their own attendance % on their profile", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/leave");
    await expect(page.getByRole("link", { name: "Baraka Other" })).toHaveCount(0);

    await page.goto("/members/member-e2e-att-1");
    await expect(page.getByText("100%")).toBeVisible();
  });

  test("HR rejects a leave request with a comment", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/leave/leave-other-1");
    const rejectForm = page.locator("form", { has: page.getByRole("button", { name: "Reject" }) });
    await rejectForm.getByLabel("Comment").fill("No supporting details provided.");
    await rejectForm.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText("Rejected").first()).toBeVisible();
  });
});
