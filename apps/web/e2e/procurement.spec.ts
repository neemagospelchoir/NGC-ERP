import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 9.3 (Procurement) end-to-end verification. Covers: a Finance
 * Manager starting a procurement request from an already-approved expense
 * request, selecting a vendor, recording a purchase (which flips the
 * request to "purchased"), recording payment against the purchase order,
 * creating an inventory record from it (reusing `inventory.createAsset`),
 * and finally permission gating for a plain member (no Procurement nav
 * link, denied direct access to the list page).
 *
 * The seeded `expense_requests` row starts already `status: "approved"` —
 * Procurement has no workflow of its own to walk through first (see
 * docs/PHASE_9_3.md §2.1's "implicitly pre-approved" design decision); the
 * e2e scope here begins exactly where that decision says Procurement's own
 * responsibility begins.
 */
const FINANCE_MANAGER: MockUser = { id: "user-finance-3", email: "finance-mgr3@ngc.org", password: "CorrectHorse123!", displayName: "Finance Manager" };
const MEMBER_USER: MockUser = { id: "user-member-11", email: "member-procurement@ngc.org", password: "CorrectHorse123!", displayName: "Furaha Member" };

const SEED_DATA = {
  users: [
    { id: FINANCE_MANAGER.id, email: FINANCE_MANAGER.email, display_name: FINANCE_MANAGER.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  user_roles: [{ user_id: FINANCE_MANAGER.id, role_id: "role-finance", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-finance", code: "finance_manager", name: "Finance Manager" }],
  role_permissions: [
    { role_id: "role-finance", permission_id: "perm-expenses-manage" },
    { role_id: "role-finance", permission_id: "perm-procurement-manage" },
  ],
  permissions: [
    { id: "perm-expenses-manage", code: "finance.expenses.manage" },
    { id: "perm-procurement-manage", code: "finance.procurement.manage" },
  ],
  system_settings: [{ setting_key: "id_format.asset_tag", value: "AST-2026-{sequence}" }],
  expense_requests: [
    {
      id: "expense-approved-1",
      request_number: "EXP-2026-0099",
      requested_by: FINANCE_MANAGER.id,
      description: "New PA speakers",
      amount: 250000,
      currency: "TZS",
      category: "equipment",
      department_id: null,
      event_id: null,
      supporting_document_id: null,
      payment_reference: null,
      status: "approved",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  vendors: [
    {
      id: "vendor-1",
      name: "Sound Solutions Ltd",
      category_id: "vendor-cat-1",
      contact_person: null,
      phone: null,
      email: null,
      address: null,
      tax_information: null,
      bank_payment_information: null,
      performance_notes: null,
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  vendor_categories: [{ id: "vendor-cat-1", name: "Audio Equipment", description: null }],
  asset_categories: [{ id: "cat-audio", name: "Audio Equipment", description: null, is_active: true, created_at: "2026-01-01T00:00:00.000Z" }],
  assets: [],
  procurement_requests: [],
  purchase_orders: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 9.3: Procurement", () => {
  test.beforeEach(async () => {
    await seedMockServer([FINANCE_MANAGER, MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("full lifecycle: start from approved expense, select vendor, purchase, payment, inventory record", async ({ page }) => {
    await signIn(page, FINANCE_MANAGER);
    await page.goto("/procurement");

    await page.getByLabel("Approved expense request").selectOption({ label: "EXP-2026-0099 — New PA speakers (TZS 250,000)" });
    await page.getByLabel("Description").fill("PA speakers for main hall");
    await page.getByRole("button", { name: "Start procurement" }).click();
    await expect(page.getByText("PA speakers for main hall")).toBeVisible();

    await page.getByRole("link", { name: "PA speakers for main hall" }).click();
    await expect(page).toHaveURL(/\/procurement\/.+/);

    await page.getByLabel("Vendor").selectOption({ label: "Sound Solutions Ltd" });
    await page.getByRole("button", { name: "Select vendor" }).click();
    await expect(page.getByText("Vendor selected")).toBeVisible();

    await page.getByLabel("Amount").fill("250000");
    await page.getByRole("button", { name: "Record purchase" }).click();
    await expect(page.getByText("Purchased").first()).toBeVisible();
    await expect(page.getByText("TZS 250,000")).toBeVisible();

    await page.getByLabel("Payment status").selectOption("paid");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Paid").first()).toBeVisible();

    await page.getByLabel("Asset category").selectOption({ label: "Audio Equipment" });
    await page.getByLabel("Asset name").fill("PA Speaker (pair)");
    await page.getByRole("button", { name: "Create inventory record" }).click();
    await expect(page.getByText("Inventory record created.")).toBeVisible();
  });

  test("a plain member has no Procurement nav link and is denied direct access", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Procurement" })).toHaveCount(0);

    await page.goto("/procurement");
    await expect(page.getByText("You don't have permission to view procurement.")).toBeVisible();
  });
});
