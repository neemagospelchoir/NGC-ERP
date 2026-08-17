import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 10.2 (Communications: Notifications) end-to-end verification.
 * Covers: a PRO/Spokesperson creating a notification template, sending an
 * ad hoc in-app notification to specific users, the recipient seeing it in
 * their "My notifications" inbox and marking it read, and a plain member
 * confirmed to have no composer/template-management affordances.
 */
const PRO: MockUser = { id: "user-pro-2", email: "pro2@ngc.org", password: "CorrectHorse123!", displayName: "PRO Spokesperson" };
const MEMBER_USER: MockUser = { id: "user-member-13", email: "member-notify@ngc.org", password: "CorrectHorse123!", displayName: "Furaha Member" };

const SEED_DATA = {
  users: [
    { id: PRO.id, email: PRO.email, display_name: PRO.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  user_roles: [{ user_id: PRO.id, role_id: "role-pro", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-pro", code: "pro_spokesperson", name: "PRO / Spokesperson" }],
  role_permissions: [
    { role_id: "role-pro", permission_id: "perm-notifications-send" },
    { role_id: "role-pro", permission_id: "perm-templates-manage" },
  ],
  permissions: [
    { id: "perm-notifications-send", code: "communications.notifications.send" },
    { id: "perm-templates-manage", code: "communications.templates.manage" },
  ],
  notification_templates: [],
  notifications: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 10.2: Notifications", () => {
  test.beforeEach(async () => {
    await seedMockServer([PRO, MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("PRO creates a template and sends a notification; the recipient reads and marks it read", async ({ page }) => {
    await signIn(page, PRO);
    await page.goto("/notifications/templates");

    await page.getByLabel("Code").fill("rehearsal_reminder");
    await page.getByLabel("Name").fill("Rehearsal Reminder");
    await page.getByLabel("Body template").fill("Reminder: rehearsal at {{time}}.");
    await page.getByRole("button", { name: "Create template" }).click();
    await expect(page.getByRole("link", { name: "Rehearsal Reminder" })).toBeVisible();

    await page.goto("/notifications");
    await page.getByLabel("Audience").selectOption("specific_users");
    await page.getByLabel("User IDs").fill(MEMBER_USER.id);
    await page.getByLabel("Message").fill("Rehearsal moved to Saturday 3pm.");
    await page.getByRole("button", { name: "Send notification" }).click();
    await expect(page.getByText("Sent to 1 recipient.")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, MEMBER_USER);
    await page.goto("/notifications");
    await expect(page.getByText("Rehearsal moved to Saturday 3pm.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark read" })).toBeVisible();

    await page.getByRole("button", { name: "Mark read" }).click();
    await expect(page.getByRole("button", { name: "Mark read" })).toHaveCount(0);
    await expect(page.getByText("Read").first()).toBeVisible();
  });

  test("a plain member sees their inbox but no composer or template-management affordances", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/notifications");

    await expect(page.getByRole("heading", { name: "My notifications" })).toBeVisible();
    await expect(page.getByText("You have no notifications yet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Send a notification" })).toHaveCount(0);

    await page.goto("/notifications/templates");
    await expect(page.getByText("You don't have permission to manage notification templates.")).toBeVisible();
  });
});
