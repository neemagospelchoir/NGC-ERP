import { createHash } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 7.2 (Onboarding: public /join applicant flow, HR application
 * review/decision, conversion to member + probation, probation
 * completion/failure) end-to-end verification — same real-server/real-mock
 * harness as auth.spec.ts/directory.spec.ts.
 *
 * Two signed-in identities:
 *   - HR_USER holds `members.applications.manage` + `members.applications.read`,
 *     so the Applications/Probation nav links and every review/decision/
 *     conversion/probation action are visible and reachable.
 *   - PLAIN_USER holds neither permission — used to verify the write
 *     affordances are actually gated, not just hidden by convention.
 *
 * Most HR-side tests seed an `applications`/`probation` row directly at the
 * status under test (same "seed the state, don't re-walk the whole pipeline
 * every time" approach as directory.spec.ts's member seeding) rather than
 * re-running the public /join flow — the one exception is the first test,
 * which exercises /join itself end-to-end since nothing else does.
 */
const HR_USER: MockUser = {
  id: "user-hr-2",
  email: "hr-onboarding@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Consolata HR",
};

const PLAIN_USER: MockUser = {
  id: "user-plain-1",
  email: "plain@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Juma Plain",
};

/** SHA-256 hex digest, matching packages/services/src/applications/token.ts's hashToken() exactly (same algorithm, just computed with Node's crypto module here instead of Web Crypto — both produce the identical standard SHA-256 hex digest). */
function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

const RESUME_TOKEN = "resume-token-123";

const FULL_SUBMITTED_DATA = {
  personal: {
    firstName: "Consolata",
    lastName: "Massawe",
    gender: "female",
    dateOfBirth: "1995-05-20",
    phone: "0700111222",
    email: "consolata@ngc.org",
    physicalAddress: "12 Uhuru St, Dar es Salaam",
    emergencyContactName: "Baraka Massawe",
    emergencyContactPhone: "0700111333",
  },
  church: { currentChurch: "Upendo Parish" },
  education: {},
  professional: {},
  choirHistory: {},
  musical: {},
};

const SEED_DATA = {
  users: [
    { id: HR_USER.id, email: HR_USER.email, display_name: HR_USER.displayName, is_active: true },
    { id: PLAIN_USER.id, email: PLAIN_USER.email, display_name: PLAIN_USER.displayName, is_active: true },
  ],
  departments: [{ id: "dept-onb-1", name: "Sopranos", description: null, is_active: true }],
  families: [{ id: "family-onb-1", name: "Family A", description: null, is_active: true }],
  user_roles: [{ user_id: HR_USER.id, role_id: "role-hr-onb", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-hr-onb", code: "hr_deputy_secretary", name: "HR Deputy Secretary" }],
  role_permissions: [{ role_id: "role-hr-onb", permission_id: "perm-app-manage" }, { role_id: "role-hr-onb", permission_id: "perm-app-read" }],
  permissions: [
    { id: "perm-app-manage", code: "members.applications.manage" },
    { id: "perm-app-read", code: "members.applications.read" },
  ],
  applications: [
    {
      id: "app-review-1",
      application_number: "APP-2026-2001",
      application_type: "new_member",
      access_token_hash: "unused-hash-for-hr-only-tests",
      verification_contact: "consolata@ngc.org",
      submitted_data: FULL_SUBMITTED_DATA,
      status: "submitted",
      completion_percentage: 100,
      missing_fields: [],
      reviewed_by: null,
      reviewed_at: null,
      decision_reason: null,
      submitted_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "app-incomplete-flow",
      application_number: "APP-2026-2002",
      application_type: "new_member",
      access_token_hash: sha256Hex(RESUME_TOKEN),
      verification_contact: "resume@ngc.org",
      submitted_data: FULL_SUBMITTED_DATA,
      status: "submitted",
      completion_percentage: 100,
      missing_fields: [],
      reviewed_by: null,
      reviewed_at: null,
      decision_reason: null,
      submitted_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "app-reject-1",
      application_number: "APP-2026-2003",
      application_type: "new_member",
      access_token_hash: "unused-hash-for-hr-only-tests",
      verification_contact: "reject@ngc.org",
      submitted_data: {
        ...FULL_SUBMITTED_DATA,
        personal: { ...FULL_SUBMITTED_DATA.personal, firstName: "Zainabu", lastName: "Rejected" },
      },
      status: "pending_approval",
      completion_percentage: 100,
      missing_fields: [],
      reviewed_by: null,
      reviewed_at: null,
      decision_reason: null,
      submitted_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  members: [
    {
      id: "member-prob-1",
      user_id: null,
      member_number: "NGC-2026-0100",
      first_name: "Happy",
      last_name: "Path",
      preferred_name: null,
      membership_status: "probation",
      primary_department_id: "dept-onb-1",
      family_id: "family-onb-1",
      phone: "0700222333",
      email: "happy@ngc.org",
      qr_token: "qr-member-prob-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "member-prob-2",
      user_id: null,
      member_number: "NGC-2026-0101",
      first_name: "Unfortunate",
      last_name: "Case",
      preferred_name: null,
      membership_status: "probation",
      primary_department_id: "dept-onb-1",
      family_id: "family-onb-1",
      phone: "0700222444",
      email: "unfortunate@ngc.org",
      qr_token: "qr-member-prob-2",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  probation: [
    {
      id: "prob-complete-1",
      member_id: "member-prob-1",
      application_id: null,
      started_at: "2026-01-01",
      duration_days: 90,
      deadline: "2026-04-01",
      assigned_department_id: "dept-onb-1",
      assigned_family_id: "family-onb-1",
      responsible_leader_id: null,
      status: "active",
      outcome_notes: null,
      decided_by: null,
      decided_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "prob-fail-1",
      member_id: "member-prob-2",
      application_id: null,
      started_at: "2026-01-01",
      duration_days: 90,
      deadline: "2026-04-01",
      assigned_department_id: "dept-onb-1",
      assigned_family_id: "family-onb-1",
      responsible_leader_id: null,
      status: "active",
      outcome_notes: null,
      decided_by: null,
      decided_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  system_settings: [{ id: "setting-app-number", setting_key: "id_format.application_number", value: "APP-{year}-{sequence}" }],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 7.2 onboarding (applications, probation)", () => {
  test.beforeEach(async () => {
    await seedMockServer([HR_USER, PLAIN_USER], SEED_DATA);
  });

  test("an applicant can start an application, save progress, and submit it", async ({ page }) => {
    await page.goto("/join");
    await page.getByLabel("Email or phone number").fill("new.applicant@ngc.org");
    await page.getByRole("button", { name: "Start my application" }).click();

    await expect(page.getByText("Save this information now")).toBeVisible();
    const applicationNumber = (await page.locator("dd.font-mono").nth(0).innerText()).trim();
    const accessToken = (await page.locator("dd.font-mono").nth(1).innerText()).trim();
    expect(applicationNumber).toMatch(/^APP-\d{4}-\d{4}$/);
    expect(accessToken.length).toBeGreaterThan(10);

    await page.getByRole("link", { name: "Continue to my application" }).click();
    await expect(page).toHaveURL(/\/join\/continue/);

    await page.getByLabel("Application number").fill(applicationNumber);
    await page.getByLabel("Access code").fill(accessToken);
    await page.getByLabel("Email or phone number used at registration").fill("new.applicant@ngc.org");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: `Application ${applicationNumber}` })).toBeVisible();

    // The whole multi-section form is one native <form> — every "required"
    // field across all sections must be non-blank before the browser lets
    // ANY submit button (Save progress or Save & submit) fire, so fill
    // every required field before exercising "Save progress" below.
    await page.getByLabel("First name").fill("Neema");
    await page.getByLabel("Last name").fill("Onboarding");
    await page.getByLabel("Gender").selectOption("female");
    await page.getByLabel("Date of birth").fill("1998-03-15");
    // Required fields render their label with a trailing "*" indicator
    // (e.g. "Phone*"), which breaks Playwright's exact-text label matching
    // (it compares the label's raw textContent, asterisk included, not the
    // accessibility-tree computed name) — an attribute selector sidesteps
    // that entirely and also disambiguates from "Emergency contact phone".
    await page.locator('input[name="phone"]').fill("0700333444");
    await page.locator('input[name="email"]').fill("new.applicant@ngc.org");
    await page.getByLabel("Physical address").fill("45 Kilimani Rd, Arusha");
    await page.getByLabel("Emergency contact name").fill("Grace Onboarding");
    await page.getByLabel("Emergency contact phone").fill("0700333555");
    await page.getByLabel("Current church").fill("Grace Chapel");

    await page.getByRole("button", { name: "Save progress" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.getByRole("button", { name: "Save & submit application" }).click();

    await expect(page.getByText("Submitted — awaiting review")).toBeVisible();
  });

  test("HR reviews and approves an application, converts it to a member, and probation starts", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/applications");
    await expect(page.getByRole("link", { name: "APP-2026-2001" })).toBeVisible();
    await page.getByRole("link", { name: "APP-2026-2001" }).click();
    await expect(page).toHaveURL(/\/applications\/app-review-1/);

    await page.getByRole("button", { name: "Move to pending review" }).click();
    await expect(page.getByRole("button", { name: "Move to under verification" })).toBeVisible();
    await page.getByRole("button", { name: "Move to under verification" }).click();
    await expect(page.getByRole("button", { name: "Move to pending approval" })).toBeVisible();
    await page.getByRole("button", { name: "Move to pending approval" }).click();

    await expect(page.getByLabel("Reason for approval")).toBeVisible();
    await page.getByLabel("Reason for approval").fill("Meets all requirements.");
    await page.getByRole("button", { name: "Approve" }).click();

    await expect(page.getByRole("heading", { name: "Convert to member" })).toBeVisible();
    await page.getByLabel("Primary department").selectOption({ label: "Sopranos" });
    await page.getByLabel("Family").selectOption({ label: "Family A" });
    await page.getByRole("button", { name: "Create member & start probation" }).click();
    // The "Convert to member" card only renders while status === "approved" —
    // its disappearance is the deterministic signal that the action
    // completed and the page revalidated with the new "probation" status.
    await expect(page.getByRole("heading", { name: "Convert to member" })).toHaveCount(0);

    await page.goto("/members");
    await expect(page.getByRole("link", { name: /Consolata Massawe/ })).toBeVisible();

    await page.goto("/probation");
    await expect(page.getByRole("link", { name: /Consolata Massawe/ })).toBeVisible();
  });

  test("HR completes a probation, activating the member", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/probation/prob-complete-1");
    await expect(page.getByRole("heading", { name: "Happy Path" })).toBeVisible();

    await page.getByRole("button", { name: "Mark completed" }).click();
    await expect(page.getByText("Completed").first()).toBeVisible();

    await page.goto("/members/member-prob-1");
    await expect(page.getByText("Active").first()).toBeVisible();
  });

  test("HR fails a probation, exiting the member with a required reason", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/probation/prob-fail-1");
    await expect(page.getByRole("heading", { name: "Unfortunate Case" })).toBeVisible();

    await page.getByLabel("Reason (required)").fill("Repeated unexcused absences during probation.");
    await page.getByRole("button", { name: "Mark failed" }).click();
    await expect(page.getByText("Failed").first()).toBeVisible();

    await page.goto("/members/member-prob-2");
    await expect(page.getByText("Exited").first()).toBeVisible();
  });

  test("HR marks an application incomplete, and the applicant sees the notes and resubmits", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/applications/app-incomplete-flow");
    await page.getByLabel("What needs to change?").fill("Please clarify your emergency contact relationship.");
    await page.getByRole("button", { name: "Send back as incomplete" }).click();
    await expect(page.getByText("Incomplete").first()).toBeVisible();

    await page.context().clearCookies();
    await page.goto("/join/continue");
    await page.getByLabel("Application number").fill("APP-2026-2002");
    await page.getByLabel("Access code").fill(RESUME_TOKEN);
    await page.getByLabel("Email or phone number used at registration").fill("resume@ngc.org");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("More information needed")).toBeVisible();
    await expect(page.getByText("Please clarify your emergency contact relationship.")).toBeVisible();

    await page.getByRole("button", { name: "Save & submit application" }).click();
    await expect(page.getByText("Submitted — awaiting review")).toBeVisible();
  });

  test("HR rejects an application", async ({ page }) => {
    await signIn(page, HR_USER);
    await page.goto("/applications/app-reject-1");
    await expect(page.getByLabel("Reason for rejection")).toBeVisible();
    await page.getByLabel("Reason for rejection").fill("Unable to verify church referral.");
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText("Rejected").first()).toBeVisible();
  });

  test("a non-privileged signed-in user cannot manage applications or probation", async ({ page }) => {
    await signIn(page, PLAIN_USER);

    // No Applications/Probation entries in the sidebar.
    await expect(page.getByRole("link", { name: "Applications" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Probation", exact: true })).toHaveCount(0);

    // Direct navigation still works (read is broader than this mock
    // enforces), but no write affordances render.
    await page.goto("/applications/app-review-1");
    await expect(page.getByRole("button", { name: "Move to pending review" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Convert to member" })).toHaveCount(0);

    await page.goto("/probation/prob-complete-1");
    await expect(page.getByRole("button", { name: "Mark completed" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark failed" })).toHaveCount(0);
  });
});
