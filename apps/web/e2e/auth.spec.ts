import { test, expect } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

const TEST_USER: MockUser = {
  id: "user-e2e-1",
  email: "lead@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Asha Mwakalinga",
};

const SEED_DATA = {
  users: [
    {
      id: TEST_USER.id,
      email: TEST_USER.email,
      username: "asha.m",
      display_name: TEST_USER.displayName,
      is_active: true,
    },
  ],
  members: [
    {
      id: "member-e2e-1",
      user_id: TEST_USER.id,
      member_number: "NGC-2024-0007",
      first_name: "Asha",
      last_name: "Mwakalinga",
      membership_status: "active",
      primary_department_id: "dept-sopranos",
    },
  ],
  user_roles: [
    {
      user_id: TEST_USER.id,
      role_id: "role-department-lead",
      scope_type: "department",
      scope_id: "dept-sopranos",
      revoked_at: null,
    },
  ],
  roles: [{ id: "role-department-lead", code: "department_lead", name: "Department Lead" }],
  role_permissions: [{ role_id: "role-department-lead", permission_id: "perm-attendance-record" }],
  permissions: [{ id: "perm-attendance-record", code: "attendance.record" }],
};

test.describe("Phase 6 authentication", () => {
  test.beforeEach(async () => {
    await seedMockServer([TEST_USER], SEED_DATA);
  });

  test("redirects an unauthenticated visitor from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });

  test("shows an inline error on wrong credentials and does not redirect", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Next.js's route announcer live-region also has role="alert"; scope to
    // our form's error paragraph specifically.
    await expect(page.locator("p[role='alert']")).toContainText("Incorrect email or password.");
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs in successfully and reaches the gated dashboard with the user's roles", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("banner").getByText(TEST_USER.displayName)).toBeVisible();
    await expect(page.getByText("Department Lead")).toBeVisible();
  });

  test("signs in with a username instead of an email", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email or Username").fill("asha.m");
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("banner").getByText(TEST_USER.displayName)).toBeVisible();
  });

  test("signs out and can no longer reach the dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password").fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });

  test("forgot-password always shows the generic confirmation message", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody-registered@ngc.org");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText(/password reset link has been sent/i)).toBeVisible();
  });

  test("reset-password shows an expired-link message with no active session", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText("This link has expired")).toBeVisible();
  });

  test("full password-reset link flow: request → callback exchange → set new password → dashboard", async ({
    page,
  }) => {
    // Step 1: request the reset email (this is what generates and stores
    // the PKCE code verifier cookie that the callback below consumes).
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/password reset link has been sent/i)).toBeVisible();

    // Step 2: simulate following the emailed link. In production this code
    // comes from GoTrue's email; here the mock accepts any code (see
    // mock-gotrue-server.mjs) so this exercises the real exchange/cookie/
    // redirect code path without needing a real mail transport.
    await page.goto("/auth/callback?code=mock-reset-code&next=%2Freset-password");
    await expect(page).toHaveURL(/\/reset-password$/);
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

    // Step 3: set the new password and land on the dashboard, now signed in.
    // Locate by `name` rather than accessible label text: "New password" is
    // a text substring of "Confirm new password", which makes label-based
    // queries ambiguous/flaky here.
    await page.locator('input[name="password"]').fill("BrandNewPassword123!");
    await page.locator('input[name="confirmPassword"]').fill("BrandNewPassword123!");
    await page.getByRole("button", { name: "Set new password" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("banner").getByText(TEST_USER.displayName)).toBeVisible();
  });
});
