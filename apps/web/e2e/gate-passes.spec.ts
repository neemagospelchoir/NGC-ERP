import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 8.3 (Gate Pass) end-to-end verification. Covers: a Technical
 * Manager creating a gate pass for an event, adding an equipment item to
 * it (which performs the actual equipment-to-event assignment via
 * `inventory.assignAsset`, add-item.ts), submitting it into its configured
 * 2-step approval chain (technical_manager -> secretary, seeded since
 * Phase 4), the Technical Manager deciding step 1 and the Secretary
 * deciding step 2 (fully approving it), the Technical Manager checking it
 * out, marking it in transit, and recording a good-condition return, and
 * finally permission gating for a plain member (no Gate Passes nav link,
 * denied direct access).
 */
const TECH_MANAGER: MockUser = { id: "user-tech-1", email: "tech-manager@ngc.org", password: "CorrectHorse123!", displayName: "Technical Manager" };
const SECRETARY: MockUser = { id: "user-secretary-1", email: "secretary@ngc.org", password: "CorrectHorse123!", displayName: "Secretary" };
const MEMBER_USER: MockUser = { id: "user-member-10", email: "member-gatepass@ngc.org", password: "CorrectHorse123!", displayName: "Furaha Member" };

const SEED_DATA = {
  users: [
    { id: TECH_MANAGER.id, email: TECH_MANAGER.email, display_name: TECH_MANAGER.displayName, is_active: true },
    { id: SECRETARY.id, email: SECRETARY.email, display_name: SECRETARY.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  user_roles: [
    { user_id: TECH_MANAGER.id, role_id: "role-tech", scope_type: null, scope_id: null, revoked_at: null },
    { user_id: SECRETARY.id, role_id: "role-secretary", scope_type: null, scope_id: null, revoked_at: null },
  ],
  roles: [
    { id: "role-tech", code: "technical_manager", name: "Technical Manager" },
    { id: "role-secretary", code: "secretary", name: "Secretary" },
  ],
  role_permissions: [
    { role_id: "role-tech", permission_id: "perm-gate-passes-manage" },
    { role_id: "role-secretary", permission_id: "perm-gate-passes-read" },
  ],
  permissions: [
    { id: "perm-gate-passes-manage", code: "inventory.gate_passes.manage" },
    { id: "perm-gate-passes-read", code: "inventory.gate_passes.read" },
  ],
  system_settings: [{ setting_key: "id_format.gate_pass_number", value: "GP-2026-{sequence}" }],
  events: [{ id: "event-1", name: "Crown TV Recording", event_date: "2026-12-01", status: "scheduled" }],
  asset_categories: [{ id: "cat-audio", name: "Audio Equipment", description: null, is_active: true, created_at: "2026-01-01T00:00:00.000Z" }],
  assets: [{ id: "asset-1", asset_tag: "AST-2026-0001", category_id: "cat-audio", name: "PA Speaker", availability_status: "available", condition: "good" }],
  asset_assignments: [],
  gate_passes: [],
  gate_pass_items: [],
  workflow_definitions: [{ id: "wfdef-gate-pass", record_type: "gate_pass", name: "Standard Gate Pass Approval", is_active: true, created_at: "2026-01-01T00:00:00.000Z" }],
  workflow_definition_steps: [
    { id: "step-1", workflow_definition_id: "wfdef-gate-pass", step_order: 1, required_role_code: "technical_manager", required_user_id: null },
    { id: "step-2", workflow_definition_id: "wfdef-gate-pass", step_order: 2, required_role_code: "secretary", required_user_id: null },
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

test.describe("Phase 8.3: Gate Pass", () => {
  test.beforeEach(async () => {
    await seedMockServer([TECH_MANAGER, SECRETARY, MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("full lifecycle: create, add item, 2-step approval, checkout, in transit, good return", async ({ page }) => {
    await signIn(page, TECH_MANAGER);
    await page.goto("/gate-passes");

    await page.getByLabel("Event ID").fill("event-1");
    // Person responsible defaults to the signed-in creator — leave as-is.
    await page.getByRole("button", { name: "Create gate pass" }).click();
    await expect(page.getByRole("link", { name: /GP-2026-/ })).toBeVisible();

    await page.getByRole("link", { name: /GP-2026-/ }).click();
    await expect(page).toHaveURL(/\/gate-passes\/.+/);
    const gatePassUrl = page.url();

    await page.getByLabel("Asset ID").fill("asset-1");
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText(/Asset asset-1 — Qty 1/)).toBeVisible();
    await expect(page.getByText("Not yet checked out")).toBeVisible();

    await page.getByRole("button", { name: "Submit for approval" }).click();
    await expect(page.getByText(/Currently awaiting step 1 \(technical_manager\)/)).toBeVisible();

    // Step 1: Technical Manager (who is also the creator) decides.
    await expect(page.getByRole("heading", { name: "Your decision" })).toBeVisible();
    await page.getByLabel("Decision").selectOption("approve");
    await page.getByRole("button", { name: "Submit decision" }).click();
    await expect(page.getByText(/Currently awaiting step 2 \(secretary\)/)).toBeVisible();

    // Step 2: Secretary decides.
    await page.context().clearCookies();
    await signIn(page, SECRETARY);
    await page.goto(gatePassUrl);
    await expect(page.getByRole("heading", { name: "Your decision" })).toBeVisible();
    await page.getByLabel("Decision").selectOption("approve");
    await page.getByRole("button", { name: "Submit decision" }).click();
    await expect(page.getByText("Approved").first()).toBeVisible();

    // Checkout/in-transit/return require inventory.gate_passes.manage —
    // back to Technical Manager (Secretary only holds .read).
    await page.context().clearCookies();
    await signIn(page, TECH_MANAGER);
    await page.goto(gatePassUrl);
    await page.getByRole("button", { name: "Check out" }).click();
    await expect(page.getByText("Checked out").first()).toBeVisible();

    await page.getByRole("button", { name: "Mark in transit" }).click();
    await expect(page.getByText("In transit").first()).toBeVisible();

    await page.getByLabel("Return condition").selectOption("good");
    await page.getByRole("button", { name: "Record return" }).click();
    await expect(page.getByText("Returned").first()).toBeVisible();
    await expect(page.getByText(/Returned .+ \(Good\)/)).toBeVisible();
  });

  test("a plain member sees no Gate Passes nav link and is denied direct access", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Gate Passes" })).toHaveCount(0);

    await page.goto("/gate-passes");
    await expect(page.getByText("You don't have permission to view gate passes.")).toBeVisible();
  });
});
