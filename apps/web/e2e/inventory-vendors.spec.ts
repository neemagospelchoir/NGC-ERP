import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 8.1 (Vendors registry + Inventory/Asset Management) end-to-end
 * verification. Covers: Logistics creating a vendor without ever seeing
 * financial fields, Finance adding tax/bank information to that same
 * vendor and Logistics still not seeing it afterward (0013's column-
 * masking directive, implemented for the first time in this phase — see
 * docs/PHASE_8_1.md §2.1); Inventory creating an asset, assigning it to an
 * event (availability flips to "assigned"), recording a good-condition
 * return (availability flips back to "available"), and disposing of a
 * second asset; and permission gating for a plain member (no Operations
 * nav group, and a direct visit to /vendors or /assets shows the
 * permission-denied message).
 */
const LOGISTICS_USER: MockUser = { id: "user-logistics-1", email: "logistics@ngc.org", password: "CorrectHorse123!", displayName: "Logistics Officer" };
const FINANCE_USER: MockUser = { id: "user-finance-1", email: "finance@ngc.org", password: "CorrectHorse123!", displayName: "Finance Manager" };
const INVENTORY_USER: MockUser = { id: "user-inventory-1", email: "inventory@ngc.org", password: "CorrectHorse123!", displayName: "Inventory Officer" };
const MEMBER_USER: MockUser = { id: "user-member-8", email: "member-ops@ngc.org", password: "CorrectHorse123!", displayName: "Kessy Member" };

const SEED_DATA = {
  users: [
    { id: LOGISTICS_USER.id, email: LOGISTICS_USER.email, display_name: LOGISTICS_USER.displayName, is_active: true },
    { id: FINANCE_USER.id, email: FINANCE_USER.email, display_name: FINANCE_USER.displayName, is_active: true },
    { id: INVENTORY_USER.id, email: INVENTORY_USER.email, display_name: INVENTORY_USER.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  user_roles: [
    { user_id: LOGISTICS_USER.id, role_id: "role-logistics", scope_type: null, scope_id: null, revoked_at: null },
    { user_id: FINANCE_USER.id, role_id: "role-finance", scope_type: null, scope_id: null, revoked_at: null },
    { user_id: INVENTORY_USER.id, role_id: "role-inventory", scope_type: null, scope_id: null, revoked_at: null },
  ],
  roles: [
    { id: "role-logistics", code: "logistics_officer", name: "Logistics Officer" },
    { id: "role-finance", code: "finance_manager", name: "Finance Manager" },
    { id: "role-inventory", code: "inventory_officer", name: "Inventory Officer" },
  ],
  role_permissions: [
    { role_id: "role-logistics", permission_id: "perm-logistics-vendors" },
    { role_id: "role-finance", permission_id: "perm-finance-vendors" },
    { role_id: "role-inventory", permission_id: "perm-inventory-assets" },
    { role_id: "role-inventory", permission_id: "perm-inventory-categories" },
  ],
  permissions: [
    { id: "perm-logistics-vendors", code: "logistics.vendors.manage" },
    { id: "perm-finance-vendors", code: "finance.vendors.manage" },
    { id: "perm-inventory-assets", code: "inventory.assets.manage" },
    { id: "perm-inventory-categories", code: "inventory.categories.manage" },
  ],
  system_settings: [{ setting_key: "id_format.asset_tag", value: "AST-2026-{sequence}" }],
  vendor_categories: [{ id: "cat-transport", name: "Transport", created_at: "2026-01-01T00:00:00.000Z" }],
  vendors: [],
  asset_categories: [{ id: "cat-audio", name: "Audio Equipment", description: null, is_active: true, created_at: "2026-01-01T00:00:00.000Z" }],
  assets: [],
  asset_assignments: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 8.1: Vendors & Inventory/Assets", () => {
  test.beforeEach(async () => {
    await seedMockServer(
      [LOGISTICS_USER, FINANCE_USER, INVENTORY_USER, MEMBER_USER],
      SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]
    );
  });

  test("Logistics creates a vendor without financial fields; Finance adds them; Logistics still cannot see them", async ({ page }) => {
    await signIn(page, LOGISTICS_USER);
    await page.goto("/vendors");

    // Financial fields are not even rendered for Logistics.
    await expect(page.getByLabel("Tax information")).toHaveCount(0);
    await expect(page.getByLabel("Bank/payment information")).toHaveCount(0);

    await page.getByLabel("Vendor name").fill("Kilimanjaro Coaches");
    await page.getByLabel("Category").selectOption({ label: "Transport" });
    await page.getByLabel("Contact person").fill("Juma");
    await page.getByRole("button", { name: "Add vendor" }).click();
    await expect(page.getByRole("link", { name: "Kilimanjaro Coaches" })).toBeVisible();

    await page.getByRole("link", { name: "Kilimanjaro Coaches" }).click();
    await expect(page).toHaveURL(/\/vendors\/.+/);
    await expect(page.getByLabel("Tax information")).toHaveCount(0);
    await expect(page.getByText("managed by Finance")).toBeVisible();
    const vendorUrl = page.url();

    await page.context().clearCookies();
    await signIn(page, FINANCE_USER);
    await page.goto(vendorUrl);
    await expect(page.getByLabel("Tax information")).toBeVisible();
    await page.getByLabel("Tax information").fill("TIN-99887");
    await page.getByLabel("Bank/payment information").fill("NBC 001-002-003");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByLabel("Tax information")).toHaveValue("TIN-99887");

    await page.context().clearCookies();
    await signIn(page, LOGISTICS_USER);
    await page.goto(vendorUrl);
    await expect(page.getByLabel("Tax information")).toHaveCount(0);
    await expect(page.getByText("managed by Finance")).toBeVisible();
  });

  test("Inventory creates an asset, assigns it to an event, and records a good-condition return", async ({ page }) => {
    await signIn(page, INVENTORY_USER);
    await page.goto("/assets");

    // The "Category" label appears twice on this page (the filter form and
    // the create form) — scope to the form containing "Asset name" to
    // disambiguate, same technique directory.spec.ts uses for
    // Department/Family pickers.
    const addAssetForm = page.locator("form", { has: page.getByLabel("Asset name") });
    await addAssetForm.getByLabel("Asset name").fill("PA Speaker");
    await addAssetForm.getByLabel("Category").selectOption({ label: "Audio Equipment" });
    await page.getByRole("button", { name: "Add asset" }).click();
    await expect(page.getByRole("link", { name: /^AST-/ })).toBeVisible();

    await page.getByRole("link", { name: /^AST-/ }).click();
    await expect(page).toHaveURL(/\/assets\/.+/);
    await expect(page.getByText("Available").first()).toBeVisible();

    await page.getByLabel("Assign to").selectOption({ label: "Event" });
    await page.getByLabel("Target ID").fill("11111111-1111-1111-1111-111111111111");
    await page.getByRole("button", { name: "Assign" }).click();

    await expect(page.getByText("Assigned").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Record return" })).toBeVisible();

    await page.getByLabel("Return condition").selectOption("good");
    await page.getByRole("button", { name: "Record return" }).click();

    await expect(page.getByText("Available").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assign this asset" })).toBeVisible();
  });

  test("Inventory disposes of an asset, which is never deleted", async ({ page }) => {
    await signIn(page, INVENTORY_USER);
    await page.goto("/assets");
    const addAssetForm = page.locator("form", { has: page.getByLabel("Asset name") });
    await addAssetForm.getByLabel("Asset name").fill("Old Mixer");
    await addAssetForm.getByLabel("Category").selectOption({ label: "Audio Equipment" });
    await page.getByRole("button", { name: "Add asset" }).click();
    await page.getByRole("link", { name: /^AST-/ }).click();

    await page.getByLabel("Disposal reason").fill("Beyond repair after water damage.");
    await page.getByRole("button", { name: "Dispose asset" }).click();

    await expect(page.getByText("Disposed")).toBeVisible();
    // Still on its own detail page — the record was never deleted.
    await expect(page).toHaveURL(/\/assets\/.+/);
  });

  test("a plain member sees no Operations nav links and is denied direct access", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Vendors" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Assets" })).toHaveCount(0);

    await page.goto("/vendors");
    await expect(page.getByText("You don't have permission to view vendors.")).toBeVisible();

    await page.goto("/assets");
    await expect(page.getByText("You don't have permission to view the asset registry.")).toBeVisible();
  });
});
