import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 9.1 (Contributions) end-to-end verification. Covers: a Finance
 * Manager creating a campaign, recording a contribution against it,
 * reversing a contribution, moving a campaign active -> closed, and
 * confirming a plain member sees the always-visible Contributions nav/page,
 * their own "My contributions" section (self-scoped, no permission
 * needed), but no management controls.
 *
 * Unlike Uniforms/Trips, this spec does NOT seed or assert on
 * `contribution_campaign_summary` — that table is a real-Postgres VIEW
 * (0014_finance.sql), and `mock-gotrue-server.mjs`'s generic REST GET
 * handler only ever reads back rows it was explicitly seeded with; it does
 * not compute view aggregates. `getCampaignSummary` already handles a
 * missing/empty summary row gracefully (returns `null`, and the page
 * simply omits the KPI tiles) — see docs/PHASE_9_1.md §5/§6 for why the
 * dashboard's aggregate math itself is left to real-Postgres verification
 * rather than e2e coverage.
 */
const FINANCE_MANAGER: MockUser = { id: "user-finance-1", email: "finance@ngc.org", password: "CorrectHorse123!", displayName: "Finance Manager" };
const MEMBER_USER: MockUser = { id: "user-member-10", email: "member-finance@ngc.org", password: "CorrectHorse123!", displayName: "Neema Member" };

const SEED_DATA = {
  users: [
    { id: FINANCE_MANAGER.id, email: FINANCE_MANAGER.email, display_name: FINANCE_MANAGER.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  members: [
    {
      id: "member-finance-1",
      user_id: MEMBER_USER.id,
      member_number: "NGC-2026-0010",
      first_name: "Neema",
      last_name: "Member",
      membership_status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  user_roles: [{ user_id: FINANCE_MANAGER.id, role_id: "role-finance", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-finance", code: "finance_manager", name: "Finance Manager" }],
  role_permissions: [{ role_id: "role-finance", permission_id: "perm-finance-manage" }],
  permissions: [{ id: "perm-finance-manage", code: "finance.contributions.manage" }],
  contribution_campaigns: [],
  contribution_records: [],
  contribution_campaign_summary: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 9.1: Contributions", () => {
  test.beforeEach(async () => {
    await seedMockServer([FINANCE_MANAGER, MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("Finance Manager creates a campaign, records a contribution, reverses it, and closes the campaign", async ({ page }) => {
    await signIn(page, FINANCE_MANAGER);
    await page.goto("/contributions");

    await page.getByLabel("Campaign name").fill("Christmas Fund 2026");
    await page.getByLabel("Target amount").fill("1000000");
    await page.getByRole("button", { name: "Create campaign" }).click();
    await expect(page.getByRole("link", { name: "Christmas Fund 2026" })).toBeVisible();

    await page.getByRole("link", { name: "Christmas Fund 2026" }).click();
    await expect(page).toHaveURL(/\/contributions\/.+/);

    // Scoped to the record-contribution form specifically: "Amount" is a
    // substring of "Target amount" in the Details form above it, and
    // getByLabel's exact match compares raw label text (which includes the
    // visually-hidden "*" required marker) rather than accessible-name
    // computation — same disambiguation fix as Uniforms' issue form.
    const recordForm = page.locator("form", { has: page.getByLabel("Member ID") });
    await recordForm.getByLabel("Member ID").fill("member-finance-1");
    await recordForm.getByLabel("Amount").fill("50000");
    await page.getByRole("button", { name: "Record contribution" }).click();
    await expect(page.getByText("TZS 50,000")).toBeVisible();
    await expect(page.getByText("Confirmed")).toBeVisible();

    await page.getByRole("button", { name: "Reverse" }).click();
    await expect(page.getByText("Reversed")).toBeVisible();

    await page.getByRole("button", { name: "Mark Closed" }).click();
    // `setCampaignStatus`'s state machine offers no transition out of
    // "closed" (VALID_TRANSITIONS.closed = []), so once the status change
    // has actually taken effect every "Mark ..." button disappears from the
    // page. Asserting on that absence sidesteps StatusPill's own text
    // ambiguity (its aria-hidden glyph shares an element with the label, so
    // an exact "Closed" match never resolves, and a substring match
    // collides with the "Mark Closed" button/explanatory paragraph still on
    // screen before the transition completes).
    await expect(page.getByRole("button", { name: "Mark Closed" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark Cancelled" })).toHaveCount(0);
  });

  test("a plain member sees only their own contributions and no management controls", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/contributions");

    await expect(page.getByRole("heading", { name: "My contributions" })).toBeVisible();
    await expect(page.getByText("You have no recorded contributions yet.")).toBeVisible();
    await expect(page.getByLabel("Campaign name")).toHaveCount(0);
  });
});
