import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 11 (Media) end-to-end verification. Covers: a Media Department
 * user creating, editing, and deleting a media link, and a plain member
 * confirmed to see the always-visible Media nav link and a published item,
 * but no create/edit/delete affordances or access to the manage-only
 * detail page.
 *
 * Does NOT attempt to exercise 0035's own sharing-scope RLS widening
 * (role/department/member-targeted visibility for an unpublished item) —
 * the mock enforces no RLS at all, so that is verified directly against
 * live Postgres instead (see docs/PHASE_11.md §2/§6).
 */
const MEDIA_DEPT: MockUser = { id: "user-media-1", email: "media@ngc.org", password: "CorrectHorse123!", displayName: "Media Department" };
const MEMBER_USER: MockUser = { id: "user-member-media", email: "member-media@ngc.org", password: "CorrectHorse123!", displayName: "Media Viewer Member" };

const SEED_DATA = {
  users: [
    { id: MEDIA_DEPT.id, email: MEDIA_DEPT.email, display_name: MEDIA_DEPT.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  user_roles: [{ user_id: MEDIA_DEPT.id, role_id: "role-media", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-media", code: "media_department", name: "Media Department" }],
  role_permissions: [{ role_id: "role-media", permission_id: "perm-media-manage" }],
  permissions: [{ id: "perm-media-manage", code: "media.links.manage" }],
  media_links: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 11: Media", () => {
  test.beforeEach(async () => {
    await seedMockServer([MEDIA_DEPT, MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("Media Department creates, edits, and deletes a media link", async ({ page }) => {
    await signIn(page, MEDIA_DEPT);
    await page.goto("/media");

    await page.getByLabel("URL").fill("https://youtube.com/watch?v=sunday-service");
    await page.getByLabel("Title").fill("Sunday Service Highlights");
    await page.getByRole("checkbox", { name: /Published/ }).check();
    await page.getByRole("button", { name: "Create media link" }).click();
    await expect(page.getByRole("link", { name: "Sunday Service Highlights" })).toBeVisible();

    await page.getByRole("link", { name: "Sunday Service Highlights" }).click();
    await expect(page).toHaveURL(/\/media\/.+/);

    await page.getByLabel("Title").fill("Sunday Service Highlights (Edited)");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Sunday Service Highlights (Edited)");

    await page.getByRole("button", { name: "Delete media link" }).click();
    await expect(page).toHaveURL(/\/media$/);
    await expect(page.getByText("Sunday Service Highlights (Edited)")).toHaveCount(0);
  });

  test("a plain member sees the always-visible nav link and a published item, but no create form or manage-only detail page", async ({ page }) => {
    await seedMockServer(
      [MEDIA_DEPT, MEMBER_USER],
      {
        ...SEED_DATA,
        media_links: [
          {
            id: "link-1",
            event_id: null,
            link_type: "youtube",
            url: "https://youtube.com/watch?v=published-clip",
            title: "Published Clip",
            shared_with_roles: [],
            shared_with_department_ids: [],
            shared_with_member_ids: [],
            is_published: true,
            created_by: MEDIA_DEPT.id,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      } as unknown as Parameters<typeof seedMockServer>[1]
    );

    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Media", exact: true })).toBeVisible();

    await page.goto("/media");
    await expect(page.getByRole("heading", { name: "New media link" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Published Clip" })).toBeVisible();

    await page.goto("/media/link-1");
    await expect(page.getByText("You don't have permission to manage media links.")).toBeVisible();
  });
});
