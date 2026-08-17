import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 7.1 (Directory foundation: Departments, Families, Members)
 * end-to-end verification — same real-server/real-mock harness as
 * auth.spec.ts (see playwright.config.ts's doc comment for why this has to
 * be a genuine second Node process rather than a page.route() intercept).
 *
 * Three signed-in identities are used across these tests:
 *   - HR_USER holds `members.profiles.manage`, `admin.departments.manage`,
 *     and `admin.families.manage`, so the Members detail page shows the HR
 *     full-record form + department/family reassignment, and the
 *     Departments/Families create-forms and deactivate controls are
 *     visible too.
 *   - MEMBER_USER holds no such permission and IS the member being viewed
 *     at member-e2e-2, so the Members detail page shows the self-service
 *     contact-info form instead.
 *   - member-e2e-3 has no linked user_id at all — MEMBER_USER viewing it
 *     exercises the third branch: read-only display, no form at all.
 */
const HR_USER: MockUser = {
  id: "user-hr-1",
  email: "hr@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Grace HR",
};

const MEMBER_USER: MockUser = {
  id: "user-member-1",
  email: "member@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Baraka Mwangi",
};

const SEED_DATA = {
  users: [
    { id: HR_USER.id, email: HR_USER.email, display_name: HR_USER.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  departments: [
    { id: "dept-sopranos", name: "Sopranos", description: "Soprano section", is_active: true },
    { id: "dept-altos", name: "Altos", description: "Alto section", is_active: true },
  ],
  families: [
    { id: "family-a", name: "Family A", description: null, is_active: true },
    { id: "family-b", name: "Family B", description: null, is_active: true },
  ],
  members: [
    {
      id: "member-e2e-2",
      user_id: MEMBER_USER.id,
      member_number: "NGC-2024-0002",
      first_name: "Baraka",
      last_name: "Mwangi",
      preferred_name: null,
      membership_status: "active",
      primary_department_id: "dept-sopranos",
      family_id: "family-a",
      phone: "0700000002",
      email: MEMBER_USER.email,
      qr_token: "qr-member-e2e-2",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "member-e2e-3",
      user_id: null,
      member_number: "NGC-2024-0003",
      first_name: "Zawadi",
      last_name: "Juma",
      preferred_name: null,
      membership_status: "probation",
      primary_department_id: "dept-altos",
      family_id: "family-b",
      phone: "0700000003",
      email: "zawadi@ngc.org",
      qr_token: "qr-member-e2e-3",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  user_roles: [
    { user_id: HR_USER.id, role_id: "role-hr", scope_type: null, scope_id: null, revoked_at: null },
  ],
  roles: [{ id: "role-hr", code: "hr_deputy_secretary", name: "HR Deputy Secretary" }],
  role_permissions: [
    { role_id: "role-hr", permission_id: "perm-members-manage" },
    { role_id: "role-hr", permission_id: "perm-departments-manage" },
    { role_id: "role-hr", permission_id: "perm-families-manage" },
  ],
  permissions: [
    { id: "perm-members-manage", code: "members.profiles.manage" },
    { id: "perm-departments-manage", code: "admin.departments.manage" },
    { id: "perm-families-manage", code: "admin.families.manage" },
  ],
  system_settings: [{ id: "setting-member-number", setting_key: "id_format.member_number", value: "NGC-{year}-{sequence}" }],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 7.1 directory (departments, families, members)", () => {
  test.beforeEach(async () => {
    await seedMockServer([HR_USER, MEMBER_USER], SEED_DATA);
  });

  test("lists, creates, and edits a department", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/departments");
    await expect(page.getByRole("link", { name: "Sopranos" })).toBeVisible();

    await page.getByLabel("Name").fill("Tenors");
    await page.getByLabel("Description").fill("Tenor section");
    await page.getByRole("button", { name: "Add department" }).click();
    await expect(page.getByRole("link", { name: "Tenors" })).toBeVisible();

    await page.getByRole("link", { name: "Tenors" }).click();
    await expect(page).toHaveURL(/\/departments\/.+/);
    await page.getByLabel("Name").fill("Tenors Section");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { name: "Tenors Section" })).toBeVisible();

    await page.getByRole("button", { name: "Deactivate department" }).click();
    await expect(page.getByText("Inactive")).toBeVisible();
  });

  test("lists, creates, and edits a family", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/families");
    await expect(page.getByRole("link", { name: "Family A" })).toBeVisible();

    await page.getByLabel("Name").fill("Family C");
    await page.getByRole("button", { name: "Add family" }).click();
    await expect(page.getByRole("link", { name: "Family C" })).toBeVisible();
  });

  test("members list shows seeded members and supports filtering by status", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/members");
    await expect(page.getByRole("link", { name: /Baraka Mwangi/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Zawadi Juma/ })).toBeVisible();

    await page.getByLabel("Status").selectOption("probation");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("link", { name: /Zawadi Juma/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Baraka Mwangi/ })).toHaveCount(0);
  });

  test("HR adds a new member, who starts in probation", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/members/new");
    await page.getByLabel("First name").fill("Neema");
    await page.getByLabel("Last name").fill("Kessy");
    await page.getByRole("button", { name: "Add member" }).click();

    await expect(page).toHaveURL(/\/members\/.+/);
    await expect(page.getByRole("heading", { name: "Neema Kessy" })).toBeVisible();
    // "Probation" also appears as an <option> text inside the (hidden by
    // default) membership-status <select> further down the page — .first()
    // resolves to the status pill badge, which is the actual DOM order.
    await expect(page.getByText("Probation").first()).toBeVisible();
  });

  test("HR edits a member's full record and reassigns department and family", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/members/member-e2e-3");

    // The HR path shows the full record form (membership status is
    // editable), not the self-service contact form.
    await expect(page.getByLabel("Membership status")).toBeVisible();
    await page.getByLabel("Membership status").selectOption("active");
    await page.getByRole("button", { name: "Save changes" }).click();
    // Same note as above — the status pill badge is the first DOM match
    // (non-exact: the badge's own text node sits alongside its icon span,
    // so its normalized text is "●Active", not an exact "Active").
    await expect(page.getByText("Active").first()).toBeVisible();

    await page.getByRole("heading", { name: "Reassign department" }).scrollIntoViewIfNeeded();
    const departmentForm = page.locator("form", { has: page.getByLabel("Department") });
    await departmentForm.getByLabel("Department").selectOption({ label: "Sopranos" });
    await departmentForm.getByRole("button", { name: "Assign" }).click();
    await expect(page.getByText(/Department: Sopranos/)).toBeVisible();

    const familyForm = page.locator("form", { has: page.getByLabel("Family") });
    await familyForm.getByLabel("Family").selectOption({ label: "Family A" });
    await familyForm.getByRole("button", { name: "Assign" }).click();
    await expect(page.getByText(/Family: Family A/)).toBeVisible();
  });

  test("a member can edit their own contact info but not their status or department", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/members/member-e2e-2");

    await expect(page.getByLabel("Phone", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Membership status")).toHaveCount(0);
    await expect(page.getByText("Reassign department")).toHaveCount(0);

    await page.getByLabel("Phone", { exact: true }).fill("0711111111");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("0711111111");
  });

  test("a member viewing someone else's profile sees read-only details, no edit form", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/members/member-e2e-3");

    await expect(page.getByRole("heading", { name: "Zawadi Juma" })).toBeVisible();
    await expect(page.getByLabel("Phone", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Membership status")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  });

  test("a non-HR member cannot see or reach the write affordances they lack permission for", async ({ page }) => {
    await signIn(page, MEMBER_USER);

    // No "Add member" action on the list page, and /members/new refuses
    // directly, since MEMBER_USER holds no members.profiles.manage grant.
    await page.goto("/members");
    await expect(page.getByRole("link", { name: "Add member" })).toHaveCount(0);
    await page.goto("/members/new");
    await expect(page.getByText("You don't have permission to add a member")).toBeVisible();
    await expect(page.getByLabel("First name")).toHaveCount(0);

    // Same story for Departments/Families: MEMBER_USER can read the
    // directory (RLS allows any authenticated user) but sees no create
    // form and no deactivate control, since it holds neither
    // admin.departments.manage nor admin.families.manage.
    await page.goto("/departments");
    await expect(page.getByRole("link", { name: "Sopranos" })).toBeVisible();
    await expect(page.getByText("Add a department")).toHaveCount(0);
    await page.getByRole("link", { name: "Sopranos" }).click();
    await expect(page.getByRole("button", { name: "Deactivate department" })).toHaveCount(0);

    await page.goto("/families");
    await expect(page.getByText("Add a family")).toHaveCount(0);
  });
});
