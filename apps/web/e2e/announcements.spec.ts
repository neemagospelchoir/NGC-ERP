import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 10.1 (Communications: Announcements) end-to-end verification.
 * Covers: a PRO/Spokesperson posting an announcement, editing it, deleting
 * it, and a plain member confirmed to see the always-visible Announcements
 * nav link and read what's posted, but with no create/edit/delete
 * affordances shown or reachable.
 */
const PRO: MockUser = { id: "user-pro-1", email: "pro@ngc.org", password: "CorrectHorse123!", displayName: "PRO Spokesperson" };
const MEMBER_USER: MockUser = { id: "user-member-12", email: "member-announce@ngc.org", password: "CorrectHorse123!", displayName: "Furaha Member" };

const SEED_DATA = {
  users: [
    { id: PRO.id, email: PRO.email, display_name: PRO.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  user_roles: [{ user_id: PRO.id, role_id: "role-pro", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-pro", code: "pro_spokesperson", name: "PRO / Spokesperson" }],
  role_permissions: [{ role_id: "role-pro", permission_id: "perm-announcements-manage" }],
  permissions: [{ id: "perm-announcements-manage", code: "communications.announcements.manage" }],
  announcements: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 10.1: Announcements", () => {
  test.beforeEach(async () => {
    await seedMockServer([PRO, MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("PRO posts, edits, and deletes an announcement", async ({ page }) => {
    await signIn(page, PRO);
    await page.goto("/announcements");

    await page.getByLabel("Title").fill("Rehearsal moved to Saturday");
    await page.getByLabel("Message").fill("This week's rehearsal moves to Saturday 3pm.");
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(page.getByRole("link", { name: "Rehearsal moved to Saturday" })).toBeVisible();

    await page.getByRole("link", { name: "Rehearsal moved to Saturday" }).click();
    await expect(page).toHaveURL(/\/announcements\/.+/);

    await page.getByLabel("Title").fill("Rehearsal moved to Sunday");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Rehearsal moved to Sunday");

    await page.getByRole("button", { name: "Delete announcement" }).click();
    await expect(page).toHaveURL(/\/announcements$/);
    await expect(page.getByText("Rehearsal moved to Sunday")).toHaveCount(0);
  });

  test("a plain member sees the announcement but no management controls", async ({ page }) => {
    await page.context().clearCookies();

    // Seed one announcement directly (as if the PRO already posted it).
    SEED_DATA.announcements = [
      {
        id: "ann-1",
        title: "Annual retreat dates announced",
        message: "The annual retreat will be held in December.",
        image_url: null,
        attachment_document_id: null,
        target_audience: "all",
        target_department_id: null,
        target_family_id: null,
        target_event_id: null,
        target_user_ids: [],
        priority: "normal",
        publish_at: "2026-01-01T00:00:00.000Z",
        expiry_at: null,
        author_id: PRO.id,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ] as unknown as (typeof SEED_DATA)["announcements"];
    await seedMockServer([PRO, MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);

    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Announcements" })).toBeVisible();

    await page.goto("/announcements");
    await expect(page.getByText("Annual retreat dates announced")).toBeVisible();
    await expect(page.getByRole("link", { name: "Annual retreat dates announced" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Post an announcement" })).toHaveCount(0);

    await page.goto("/announcements/ann-1");
    await expect(page.getByText("You don't have permission to manage announcements.")).toBeVisible();
  });
});
