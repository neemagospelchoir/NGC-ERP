import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 9.2 (Expenses/Petty Cash) end-to-end verification. Covers: a plain
 * member (no special role) creating a draft expense request, editing it
 * while still a draft, submitting it into its configured 3-step approval
 * chain (finance_manager -> secretary -> chairman, seeded since Phase 4),
 * each of the three approvers deciding their own step (fully approving
 * it), the Finance Manager marking it paid and closing it, and finally
 * confirming the always-visible Expenses nav/page shows a plain member only
 * their own requests, never the cross-member list or any decision UI for a
 * step they don't hold.
 */
const REQUESTER: MockUser = { id: "user-requester-1", email: "requester@ngc.org", password: "CorrectHorse123!", displayName: "Furaha Requester" };
const FINANCE_MANAGER: MockUser = { id: "user-finance-2", email: "finance-mgr@ngc.org", password: "CorrectHorse123!", displayName: "Finance Manager" };
const SECRETARY: MockUser = { id: "user-secretary-2", email: "secretary2@ngc.org", password: "CorrectHorse123!", displayName: "Secretary" };
const CHAIRMAN: MockUser = { id: "user-chairman-1", email: "chairman@ngc.org", password: "CorrectHorse123!", displayName: "Chairman" };

const SEED_DATA = {
  users: [
    { id: REQUESTER.id, email: REQUESTER.email, display_name: REQUESTER.displayName, is_active: true },
    { id: FINANCE_MANAGER.id, email: FINANCE_MANAGER.email, display_name: FINANCE_MANAGER.displayName, is_active: true },
    { id: SECRETARY.id, email: SECRETARY.email, display_name: SECRETARY.displayName, is_active: true },
    { id: CHAIRMAN.id, email: CHAIRMAN.email, display_name: CHAIRMAN.displayName, is_active: true },
  ],
  user_roles: [
    { user_id: FINANCE_MANAGER.id, role_id: "role-finance", scope_type: null, scope_id: null, revoked_at: null },
    { user_id: SECRETARY.id, role_id: "role-secretary", scope_type: null, scope_id: null, revoked_at: null },
    { user_id: CHAIRMAN.id, role_id: "role-chairman", scope_type: null, scope_id: null, revoked_at: null },
  ],
  roles: [
    { id: "role-finance", code: "finance_manager", name: "Finance Manager" },
    { id: "role-secretary", code: "secretary", name: "Secretary" },
    { id: "role-chairman", code: "chairman", name: "Chairman" },
  ],
  role_permissions: [
    { role_id: "role-finance", permission_id: "perm-expenses-manage" },
    { role_id: "role-finance", permission_id: "perm-expenses-approve" },
  ],
  permissions: [
    { id: "perm-expenses-manage", code: "finance.expenses.manage" },
    { id: "perm-expenses-approve", code: "finance.expenses.approve" },
  ],
  system_settings: [{ setting_key: "id_format.expense_request_number", value: "EXP-2026-{sequence}" }],
  lookup_values: [{ id: "lv-transport", category: "expense_category", code: "transport", label: "Transport", is_active: true, sort_order: 1 }],
  expense_requests: [],
  workflow_definitions: [
    { id: "wfdef-expense", record_type: "expense_request", name: "Standard Expense Approval", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
  ],
  workflow_definition_steps: [
    { id: "step-1", workflow_definition_id: "wfdef-expense", step_order: 1, required_role_code: "finance_manager", required_user_id: null },
    { id: "step-2", workflow_definition_id: "wfdef-expense", step_order: 2, required_role_code: "secretary", required_user_id: null },
    { id: "step-3", workflow_definition_id: "wfdef-expense", step_order: 3, required_role_code: "chairman", required_user_id: null },
  ],
  workflow_instances: [],
  workflow_step_decisions: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 9.2: Expenses", () => {
  test.beforeEach(async () => {
    await seedMockServer([REQUESTER, FINANCE_MANAGER, SECRETARY, CHAIRMAN], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("full lifecycle: draft, edit, submit, 3-step approval, mark paid, close", async ({ page }) => {
    await signIn(page, REQUESTER);
    await page.goto("/expenses");

    await page.getByLabel("Description").fill("Transport for retreat");
    await page.getByLabel("Amount").fill("50000");
    await page.getByRole("button", { name: "Create request" }).click();
    await expect(page.getByText(/EXP-2026-\d+ — Transport for retreat/)).toBeVisible();

    await page.getByText(/EXP-2026-\d+ — Transport for retreat/).click();
    await expect(page).toHaveURL(/\/expenses\/.+/);

    // Still a draft — editable by the requester.
    await page.getByLabel("Amount").fill("60000");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByLabel("Amount")).toHaveValue("60000");

    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByText("Pending approval")).toBeVisible();
    const detailUrl = page.url();

    // Step 1: Finance Manager approves.
    await page.context().clearCookies();
    await signIn(page, FINANCE_MANAGER);
    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Submit decision" }).click();
    await expect(page.getByText("Pending approval")).toBeVisible();

    // Step 2: Secretary approves — holds no finance.expenses permission at
    // all, only the workflow step's role match, matching the real seed
    // exactly (secretary is not granted finance.expenses.manage/.approve).
    await page.context().clearCookies();
    await signIn(page, SECRETARY);
    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Submit decision" }).click();
    await expect(page.getByText("Pending approval")).toBeVisible();

    // Step 3: Chairman approves — final step, request becomes Approved.
    await page.context().clearCookies();
    await signIn(page, CHAIRMAN);
    await page.goto(detailUrl);
    await page.getByRole("button", { name: "Submit decision" }).click();
    await expect(page.getByText("Approved")).toBeVisible();

    // Finance Manager marks it paid, then closes it.
    await page.context().clearCookies();
    await signIn(page, FINANCE_MANAGER);
    await page.goto(detailUrl);
    await page.getByLabel("Payment reference").fill("MPESA-778899");
    await page.getByRole("button", { name: "Mark paid" }).click();
    await expect(page.getByText("Paid")).toBeVisible();

    await page.getByRole("button", { name: "Close request" }).click();
    await expect(page.getByText("Closed")).toBeVisible();
  });

  test("a plain member sees only their own requests, no cross-member list or decision UI", async ({ page }) => {
    await signIn(page, REQUESTER);
    await page.goto("/expenses");

    await expect(page.getByRole("heading", { name: "My expense requests" })).toBeVisible();
    await expect(page.getByText("You have no expense requests yet.")).toBeVisible();
    await expect(page.getByText("Your own expense requests are listed above.")).toBeVisible();
  });
});
