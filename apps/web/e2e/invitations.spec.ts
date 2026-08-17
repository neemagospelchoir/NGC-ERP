import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 7.5 (Events/Invitations & Approvals) end-to-end verification.
 * Covers: the public `/invite` submission and `/invite/status` check/
 * resubmit loop, internal review (received → under_review →
 * pending_information → resubmit → under_review), starting and deciding
 * a multi-role approval chain via BOTH the invitation detail page and the
 * cross-module Approval Center (`/approvals`), the resulting `events` row
 * on final approval, a reject path, and permission gating.
 *
 * The seeded default approval chain here is deliberately 2 steps
 * (Secretary → Technical Manager), not the PRD's full 4-step default —
 * short enough to keep this spec readable while still exercising the
 * exact gap 0028_workflow_decision_function.sql fixes: TECHNICAL_USER
 * holds `management.approvals.read_all` but NOT `.manage`, so deciding
 * their step must go through `record_workflow_decision`, not a direct
 * RLS-scoped update.
 */
const SECRETARY_USER: MockUser = { id: "user-secretary-1", email: "secretary@ngc.org", password: "CorrectHorse123!", displayName: "Furaha Secretary" };
const TECHNICAL_USER: MockUser = { id: "user-technical-1", email: "technical@ngc.org", password: "CorrectHorse123!", displayName: "Yona Technical" };
const MEMBER_USER: MockUser = { id: "user-member-5", email: "member-invitations@ngc.org", password: "CorrectHorse123!", displayName: "Kessy Member" };

const SEED_DATA = {
  users: [
    { id: SECRETARY_USER.id, email: SECRETARY_USER.email, display_name: SECRETARY_USER.displayName, is_active: true },
    { id: TECHNICAL_USER.id, email: TECHNICAL_USER.email, display_name: TECHNICAL_USER.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  user_roles: [
    { user_id: SECRETARY_USER.id, role_id: "role-secretary", scope_type: null, scope_id: null, revoked_at: null },
    { user_id: TECHNICAL_USER.id, role_id: "role-technical", scope_type: null, scope_id: null, revoked_at: null },
  ],
  roles: [
    { id: "role-secretary", code: "secretary", name: "Secretary" },
    { id: "role-technical", code: "technical_manager", name: "Technical Manager" },
  ],
  role_permissions: [
    { role_id: "role-secretary", permission_id: "perm-inv-read" },
    { role_id: "role-secretary", permission_id: "perm-inv-manage" },
    { role_id: "role-secretary", permission_id: "perm-appr-read" },
    { role_id: "role-secretary", permission_id: "perm-appr-manage" },
    { role_id: "role-technical", permission_id: "perm-inv-read" },
    { role_id: "role-technical", permission_id: "perm-appr-read" }, // deliberately NO perm-appr-manage — see file header
  ],
  permissions: [
    { id: "perm-inv-read", code: "events.invitations.read" },
    { id: "perm-inv-manage", code: "events.invitations.manage" },
    { id: "perm-appr-read", code: "management.approvals.read_all" },
    { id: "perm-appr-manage", code: "management.approvals.manage" },
  ],
  system_settings: [{ setting_key: "id_format.invitation_number", value: "INV-2026-{sequence}" }],
  workflow_definitions: [{ id: "wfdef-invitation", record_type: "invitation", name: "Standard Invitation Approval", is_active: true, created_at: "2026-01-01T00:00:00.000Z" }],
  workflow_definition_steps: [
    { id: "wfstep-1", workflow_definition_id: "wfdef-invitation", step_order: 1, required_role_code: "secretary", required_user_id: null, is_mandatory: true },
    { id: "wfstep-2", workflow_definition_id: "wfdef-invitation", step_order: 2, required_role_code: "technical_manager", required_user_id: null, is_mandatory: true },
  ],
  invitations: [],
  events: [],
  comments: [],
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

async function submitInvitation(page: Page, eventName: string): Promise<{ invitationNumber: string; accessCode: string }> {
  await page.goto("/invite");
  await page.getByLabel("Your name").fill("AICT Kinondoni");
  await page.getByLabel("Event name").fill(eventName);
  await page.getByLabel("Proposed date").fill("2026-04-01");
  await page.getByLabel("Your email or phone number").fill("organizer@church.org");
  await page.getByRole("button", { name: "Submit invitation" }).click();

  await expect(page.getByText("Save this information now")).toBeVisible();
  const invitationNumber = (await page.locator("dd.font-mono").first().textContent())?.trim() ?? "";
  const accessCode = (await page.locator("dd.font-mono").nth(1).textContent())?.trim() ?? "";
  return { invitationNumber, accessCode };
}

test.describe("Phase 7.5 invitations & approvals", () => {
  test.beforeEach(async () => {
    await seedMockServer([SECRETARY_USER, TECHNICAL_USER, MEMBER_USER], SEED_DATA);
  });

  test("full happy path: public submission -> internal review -> two-role approval chain -> event created", async ({ page }) => {
    const { invitationNumber } = await submitInvitation(page, "Crown TV Recording");

    await signIn(page, SECRETARY_USER);
    await page.goto("/invitations");
    await expect(page.getByRole("link", { name: invitationNumber })).toBeVisible();

    await page.getByRole("link", { name: invitationNumber }).click();
    await page.getByRole("button", { name: "Mark received" }).click();
    await expect(page.getByText("Received").first()).toBeVisible();

    await page.getByRole("button", { name: "Start review" }).click();
    await expect(page.getByText("Under review").first()).toBeVisible();

    await page.getByRole("button", { name: "Start approval" }).click();
    await expect(page.getByText("Pending management approval").first()).toBeVisible();

    // Secretary is step 1 — decide from the Approval Center, not the detail page.
    await page.goto("/approvals");
    await expect(page.getByText(invitationNumber)).toBeVisible();
    await page.getByLabel("Decision").selectOption("approve");
    await page.getByRole("button", { name: "Submit decision" }).click();
    // Secretary holds management.approvals.read_all, so the now-advanced
    // instance (step 2, technical_manager) still shows in their Approval
    // Center — just without a decision form, since it's no longer their step.
    await expect(page.getByText("Awaiting a different approver's decision.")).toBeVisible();

    // Technical Manager is step 2 — holds management.approvals.read_all
    // but NOT .manage (0028's fix is exactly what lets this succeed).
    await page.context().clearCookies();
    await signIn(page, TECHNICAL_USER);
    await page.goto("/approvals");
    await expect(page.getByText(invitationNumber)).toBeVisible();
    await page.getByLabel("Decision").selectOption("approve");
    await page.getByRole("button", { name: "Submit decision" }).click();

    await page.context().clearCookies();
    await signIn(page, SECRETARY_USER);
    await page.goto("/invitations");
    await page.getByRole("link", { name: invitationNumber }).click();
    await expect(page.getByText("Approved").first()).toBeVisible();

    await page.goto("/events");
    await expect(page.getByText("Crown TV Recording")).toBeVisible();
  });

  test("organizer can check status and resubmit after a pending_information request", async ({ page }) => {
    const { invitationNumber, accessCode } = await submitInvitation(page, "Youth Concert");

    await signIn(page, SECRETARY_USER);
    await page.goto("/invitations");
    await page.getByRole("link", { name: invitationNumber }).click();
    await page.getByRole("button", { name: "Mark received" }).click();
    await page.getByRole("button", { name: "Start review" }).click();
    await page.getByLabel("What does the organizer need to provide or fix?").fill("Please confirm the exact venue address.");
    await page.getByRole("button", { name: "Request information" }).click();
    await expect(page.getByText("Pending information").first()).toBeVisible();

    await page.context().clearCookies();
    await page.goto("/invite/status");
    await page.getByLabel("Invitation number").fill(invitationNumber);
    await page.getByLabel("Access code").fill(accessCode);
    await page.getByLabel("Email or phone number used at submission").fill("organizer@church.org");
    await page.getByRole("button", { name: "Check status" }).click();

    await expect(page.getByText("Please confirm the exact venue address.")).toBeVisible();
    await page.getByLabel("Venue").fill("Chang'ombe Church");
    await page.getByRole("button", { name: "Resubmit" }).click();
    await expect(page.getByText("Submitted").first()).toBeVisible();

    await signIn(page, SECRETARY_USER);
    await page.goto("/invitations");
    await page.getByRole("link", { name: invitationNumber }).click();
    await expect(page.getByText("Submitted").first()).toBeVisible();
  });

  test("a rejection declines the invitation", async ({ page }) => {
    const { invitationNumber } = await submitInvitation(page, "Wedding Performance");

    await signIn(page, SECRETARY_USER);
    await page.goto("/invitations");
    await page.getByRole("link", { name: invitationNumber }).click();
    await page.getByRole("button", { name: "Mark received" }).click();
    await page.getByRole("button", { name: "Start review" }).click();
    await page.getByRole("button", { name: "Start approval" }).click();

    await page.goto("/approvals");
    await page.getByLabel("Decision").selectOption("reject");
    await page.getByLabel("Comment").fill("Date conflicts with Worship in Spirit recording.");
    await page.getByRole("button", { name: "Submit decision" }).click();

    await page.goto("/invitations");
    await page.getByRole("link", { name: invitationNumber }).click();
    await expect(page.getByText("Declined").first()).toBeVisible();
  });

  test("a plain member cannot see the Invitations module or the Approval Center", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Invitations" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Approval Center" })).toHaveCount(0);

    await page.goto("/invitations");
    await expect(page.getByText("You don't have permission to view invitations.")).toBeVisible();
  });
});
