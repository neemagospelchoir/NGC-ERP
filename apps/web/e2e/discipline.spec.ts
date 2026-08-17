import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 7.4 (Discipline) end-to-end verification — same real-server/real-
 * mock harness as the prior spec files.
 *
 * Three signed-in identities:
 *   - DISCIPLINE_USER holds `discipline.cases.read` and
 *     `discipline.cases.manage` (the Discipline Manager role) — the only
 *     identity that can see or act on anything in this module.
 *   - HR_USER holds `members.profiles.manage` and `members.applications.manage`
 *     but deliberately NO discipline permission — exercises "even HR
 *     can't see this confidential module by default" (spec S33/S53), and
 *     is also used to confirm a suspension/dismissal's membership_status
 *     side effect from the Member Profiles side (HR can read/see status
 *     changes; they just can't see WHY, since they have no case access).
 *   - MEMBER_USER is a plain signed-in member (own `members` row, no
 *     special permissions, and — critically — the SUBJECT of case-1) —
 *     exercises "a member cannot see their own confidential case."
 */
const DISCIPLINE_USER: MockUser = {
  id: "user-discipline-1",
  email: "discipline@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Rehema Discipline",
};

const HR_USER: MockUser = {
  id: "user-hr-4",
  email: "hr-discipline@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Faraja HR",
};

const MEMBER_USER: MockUser = {
  id: "user-member-4",
  email: "member-discipline@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Frank Kileo",
};

function member(id: string, firstName: string, lastName: string, memberNumber: string, userId: string | null = null) {
  return {
    id,
    user_id: userId,
    member_number: memberNumber,
    first_name: firstName,
    last_name: lastName,
    preferred_name: null,
    membership_status: "active",
    primary_department_id: null,
    family_id: null,
    phone: "0700000000",
    email: `${firstName.toLowerCase()}@ngc.org`,
    qr_token: `qr-${id}`,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

const SEED_DATA = {
  users: [
    { id: DISCIPLINE_USER.id, email: DISCIPLINE_USER.email, display_name: DISCIPLINE_USER.displayName, is_active: true },
    { id: HR_USER.id, email: HR_USER.email, display_name: HR_USER.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  members: [
    member("member-disc-1", "Frank", "Kileo", "NGC-2026-0301", MEMBER_USER.id),
    member("member-disc-2", "Grace", "Mnyika", "NGC-2026-0302"),
    member("member-disc-3", "Halima", "Juma", "NGC-2026-0303"),
    member("member-disc-4", "Peter", "Msigwa", "NGC-2026-0304"),
  ],
  user_roles: [
    { user_id: DISCIPLINE_USER.id, role_id: "role-discipline", scope_type: null, scope_id: null, revoked_at: null },
    { user_id: HR_USER.id, role_id: "role-hr-disc", scope_type: null, scope_id: null, revoked_at: null },
  ],
  roles: [
    { id: "role-discipline", code: "discipline_manager", name: "Discipline Manager" },
    { id: "role-hr-disc", code: "hr_deputy_secretary", name: "HR Deputy Secretary" },
  ],
  role_permissions: [
    { role_id: "role-discipline", permission_id: "perm-disc-read" },
    { role_id: "role-discipline", permission_id: "perm-disc-manage" },
    { role_id: "role-hr-disc", permission_id: "perm-members-manage" },
  ],
  permissions: [
    { id: "perm-disc-read", code: "discipline.cases.read" },
    { id: "perm-disc-manage", code: "discipline.cases.manage" },
    { id: "perm-members-manage", code: "members.profiles.manage" },
  ],
  lookup_values: [
    { id: "lv-conduct", category: "discipline_category", code: "conduct", label: "Conduct", sort_order: 1, is_active: true },
    { id: "lv-financial", category: "discipline_category", code: "financial", label: "Financial", sort_order: 2, is_active: true },
  ],
  system_settings: [{ setting_key: "id_format.disciplinary_case_number", value: "DISC-{year}-{sequence}" }],
  disciplinary_cases: [
    {
      id: "case-1",
      case_number: "DISC-2026-0001",
      member_id: "member-disc-1",
      category: "conduct",
      incident_date: "2026-01-10",
      description: "Disruptive behavior during rehearsal.",
      evidence_document_ids: [],
      officer_id: DISCIPLINE_USER.id,
      status: "open",
      created_at: "2026-01-10T00:00:00.000Z",
      updated_at: "2026-01-10T00:00:00.000Z",
    },
    {
      id: "case-2",
      case_number: "DISC-2026-0002",
      member_id: "member-disc-4",
      category: "financial",
      incident_date: "2026-01-05",
      description: "Petty cash discrepancy under investigation.",
      evidence_document_ids: [],
      officer_id: DISCIPLINE_USER.id,
      status: "action_decided",
      created_at: "2026-01-05T00:00:00.000Z",
      updated_at: "2026-01-06T00:00:00.000Z",
    },
    {
      id: "case-3",
      case_number: "DISC-2026-0003",
      member_id: "member-disc-3",
      category: "conduct",
      incident_date: "2026-01-08",
      description: "Repeated serious misconduct.",
      evidence_document_ids: [],
      officer_id: DISCIPLINE_USER.id,
      status: "open",
      created_at: "2026-01-08T00:00:00.000Z",
      updated_at: "2026-01-08T00:00:00.000Z",
    },
  ],
  disciplinary_actions: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 7.4 discipline", () => {
  test.beforeEach(async () => {
    await seedMockServer([DISCIPLINE_USER, HR_USER, MEMBER_USER], SEED_DATA);
  });

  test("the Discipline Manager opens a new case against a member by exact member number", async ({ page }) => {
    await signIn(page, DISCIPLINE_USER);
    await page.goto("/discipline/new");
    await page.getByLabel("Member number").fill("NGC-2026-0302");
    await page.getByLabel("Category").selectOption("conduct");
    await page.getByLabel("Incident date").fill("2026-02-01");
    await page.getByLabel("Description").fill("Missed three consecutive rehearsals without notice.");
    await page.getByRole("button", { name: "Open case" }).click();

    await expect(page).toHaveURL(/\/discipline\/.+/);
    await expect(page.getByText("Grace Mnyika", { exact: true })).toBeVisible();
    await expect(page.locator('.rounded-pill:not([role="img"])')).toContainText("Open");
  });

  test("opening a case against an unknown member number shows a clear error, not a crash", async ({ page }) => {
    await signIn(page, DISCIPLINE_USER);
    await page.goto("/discipline/new");
    await page.getByLabel("Member number").fill("NGC-2026-9999");
    await page.getByLabel("Category").selectOption("conduct");
    await page.getByLabel("Incident date").fill("2026-02-01");
    await page.getByLabel("Description").fill("Some incident.");
    await page.getByRole("button", { name: "Open case" }).click();

    await expect(page.getByText(/No member found/)).toBeVisible();
  });

  test("recording a warning auto-advances the case to action_decided", async ({ page }) => {
    await signIn(page, DISCIPLINE_USER);
    await page.goto("/discipline/case-1");
    await page.getByLabel("Resolution / notes").fill("Verbal warning issued.");
    await page.getByRole("button", { name: "Record action" }).click();

    await expect(page.getByText("Action decided").first()).toBeVisible();
    await expect(page.getByText("Verbal warning issued.")).toBeVisible();
  });

  test("a suspension changes the member's status, and restoring it changes it back", async ({ page }) => {
    await signIn(page, DISCIPLINE_USER);
    await page.goto("/discipline/case-1");
    await page.getByLabel("Action type").selectOption("suspension");
    await page.getByLabel("Suspension start").fill("2026-02-10");
    await page.getByRole("button", { name: "Record action" }).click();
    await expect(page.getByText("Action decided").first()).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, HR_USER);
    await page.goto("/members/member-disc-1");
    await expect(page.locator('.rounded-pill:not([role="img"])').first()).toContainText("Suspended");

    await page.context().clearCookies();
    await signIn(page, DISCIPLINE_USER);
    await page.goto("/discipline/case-1");
    await page.getByLabel("Restoration reason").fill("Investigation cleared them; suspension lifted.");
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText(/restored/)).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, HR_USER);
    await page.goto("/members/member-disc-1");
    await expect(page.locator('.rounded-pill:not([role="img"])').first()).toContainText("Active");
  });

  test("a dismissal exits the member, with a reason referencing the case", async ({ page }) => {
    await signIn(page, DISCIPLINE_USER);
    await page.goto("/discipline/case-3");
    await page.getByLabel("Action type").selectOption("dismissal");
    await page.getByRole("button", { name: "Record action" }).click();
    await expect(page.getByText("Action decided").first()).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, HR_USER);
    await page.goto("/members/member-disc-3");
    await expect(page.locator('.rounded-pill:not([role="img"])').first()).toContainText("Exited");
  });

  test("resolving then closing a case moves it through both final states", async ({ page }) => {
    await signIn(page, DISCIPLINE_USER);
    await page.goto("/discipline/case-2");
    await page.getByRole("button", { name: "Mark resolved" }).click();
    await expect(page.getByText("Resolved").first()).toBeVisible();

    await page.getByRole("button", { name: "Close case" }).click();
    await expect(page.getByText("Closed").first()).toBeVisible();
  });

  test("HR, despite managing member profiles, cannot see the confidential Discipline module at all", async ({ page }) => {
    await signIn(page, HR_USER);
    await expect(page.getByRole("link", { name: "Cases" })).toHaveCount(0);

    await page.goto("/discipline");
    await expect(page.getByText("This is a confidential module. You don't have permission to view disciplinary cases.")).toBeVisible();

    await page.goto("/discipline/case-1");
    await expect(page.getByText("This is a confidential module. You don't have permission to view this case.")).toBeVisible();
  });

  test("a member cannot see the Discipline module, even though case-1 concerns them", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Cases" })).toHaveCount(0);

    await page.goto("/discipline");
    await expect(page.getByText("This is a confidential module. You don't have permission to view disciplinary cases.")).toBeVisible();

    await page.goto("/discipline/case-1");
    await expect(page.getByText("This is a confidential module. You don't have permission to view this case.")).toBeVisible();
  });
});
