import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 8.2 (Uniform Management) end-to-end verification. Covers: a
 * Uniform Manager registering a uniform type, issuing it to a member, the
 * member seeing it under "My uniform issues" (self-service, no special
 * permission needed — RLS scopes this to the caller's own rows), the
 * manager recording a good-condition return (which restocks
 * quantityAvailable), retiring a uniform (which zeroes quantityAvailable
 * and hides the issue form), and confirming a plain member can see the
 * always-visible Uniforms nav link/page but not manage anything.
 */
const UNIFORM_MANAGER: MockUser = { id: "user-uniform-1", email: "uniform@ngc.org", password: "CorrectHorse123!", displayName: "Uniform Manager" };
const MEMBER_USER: MockUser = { id: "user-member-9", email: "member-uniform@ngc.org", password: "CorrectHorse123!", displayName: "Amani Member" };

const SEED_DATA = {
  users: [
    { id: UNIFORM_MANAGER.id, email: UNIFORM_MANAGER.email, display_name: UNIFORM_MANAGER.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  members: [
    {
      id: "member-uniform-1",
      user_id: MEMBER_USER.id,
      member_number: "NGC-2026-0009",
      first_name: "Amani",
      last_name: "Member",
      membership_status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  user_roles: [{ user_id: UNIFORM_MANAGER.id, role_id: "role-uniform", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-uniform", code: "uniform_manager", name: "Uniform Manager" }],
  role_permissions: [{ role_id: "role-uniform", permission_id: "perm-uniform-manage" }],
  permissions: [{ id: "perm-uniform-manage", code: "uniform.inventory.manage" }],
  lookup_values: [{ id: "lv-robe", category: "uniform_category", code: "choir_robe", label: "Choir Robe", is_active: true, sort_order: 1 }],
  uniforms: [],
  uniform_assignments: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 8.2: Uniform Management", () => {
  test.beforeEach(async () => {
    await seedMockServer([UNIFORM_MANAGER, MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("Uniform Manager registers a uniform, issues it, and records a good-condition return", async ({ page }) => {
    await signIn(page, UNIFORM_MANAGER);
    await page.goto("/uniforms");

    await page.getByLabel("Uniform type").selectOption({ label: "Choir Robe" });
    await page.getByLabel("Total quantity").fill("10");
    await page.getByRole("button", { name: "Add uniform" }).click();
    await expect(page.getByRole("link", { name: "Choir Robe" })).toBeVisible();
    await expect(page.getByText("10 / 10")).toBeVisible();

    await page.getByRole("link", { name: "Choir Robe" }).click();
    await expect(page).toHaveURL(/\/uniforms\/.+/);
    const uniformUrl = page.url();

    // Scoped to the issue form specifically: "Quantity" is a substring of
    // "Total quantity"/"Available quantity" in the Details form above, and
    // `getByLabel`'s exact match compares against the <label> element's raw
    // text content (which includes the visually-hidden "*" required marker,
    // e.g. "Quantity*") rather than the accessible-name algorithm's
    // aria-hidden-aware computation — so `{ exact: true }` alone doesn't
    // disambiguate here. Scoping to the form containing "Member ID" (unique
    // to the issue form) resolves it cleanly instead.
    const issueForm = page.locator("form", { has: page.getByLabel("Member ID") });
    await issueForm.getByLabel("Member ID").fill("member-uniform-1");
    await issueForm.getByLabel("Quantity").fill("2");
    await issueForm.getByRole("button", { name: "Issue" }).click();

    await expect(page.getByText(/Qty 2 — Assigned/)).toBeVisible();

    await page.getByLabel("Return condition").selectOption("good");
    await page.getByRole("button", { name: "Record return" }).click();
    await expect(page.getByText("All issued units of this uniform have been returned.")).toBeVisible();

    // Restocked: 10 available again, out of a total of 10.
    await page.goto(uniformUrl);
    await expect(page.getByLabel("Available quantity")).toHaveValue("10");
  });

  test("retiring a uniform zeroes its available quantity and hides the issue form", async ({ page }) => {
    await signIn(page, UNIFORM_MANAGER);
    await page.goto("/uniforms");
    await page.getByLabel("Uniform type").selectOption({ label: "Choir Robe" });
    await page.getByLabel("Total quantity").fill("5");
    await page.getByRole("button", { name: "Add uniform" }).click();
    await page.getByRole("link", { name: "Choir Robe" }).click();

    await expect(page.getByRole("heading", { name: "Issue this uniform" })).toBeVisible();
    await page.getByRole("button", { name: "Mark Retired" }).click();

    await expect(page.getByRole("heading", { name: "Issue this uniform" })).toHaveCount(0);
    await expect(page.getByLabel("Available quantity")).toHaveValue("0");
  });

  test("a member sees the always-visible Uniforms nav link, their own issued items, but no management actions", async ({ page }) => {
    await signIn(page, UNIFORM_MANAGER);
    await page.goto("/uniforms");
    await page.getByLabel("Uniform type").selectOption({ label: "Choir Robe" });
    await page.getByLabel("Total quantity").fill("5");
    await page.getByRole("button", { name: "Add uniform" }).click();
    await page.getByRole("link", { name: "Choir Robe" }).click();
    await page.getByLabel("Member ID").fill("member-uniform-1");
    await page.getByRole("button", { name: "Issue" }).click();

    await page.context().clearCookies();
    await signIn(page, MEMBER_USER);

    await expect(page.getByRole("link", { name: "Uniforms" })).toBeVisible();
    await page.goto("/uniforms");
    await expect(page.getByRole("heading", { name: "My uniform issues" })).toBeVisible();
    await expect(page.getByText(/Choir Robe — Qty 1 — Assigned/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add a uniform" })).toHaveCount(0);
  });
});
