import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 10.4 (Communications: Agenda & Voting) end-to-end verification.
 * Covers: a Secretary creating an agenda item, a plain member casting a
 * vote and seeing their own recorded choice afterward, and confirming a
 * plain member sees the always-visible "Agenda & Voting" nav link but no
 * creation form or individual-ballots section.
 *
 * This spec does NOT seed or assert on `agenda_results` — like
 * `contribution_campaign_summary` (Phase 9.1), it is a real-Postgres VIEW
 * that the mock's generic REST handler cannot compute from inserted
 * `votes` rows; `getAgendaResults` already handles a missing/empty row
 * gracefully (returns `null`, and the page omits the tally tiles) — see
 * docs/PHASE_10_4.md §6. It also does NOT attempt to exercise 0034's own
 * RLS eligibility/anonymity tightening, since the mock enforces no RLS at
 * all — that is verified directly against live Postgres instead (§2/§6).
 */
const SECRETARY: MockUser = { id: "user-secretary-1", email: "secretary@ngc.org", password: "CorrectHorse123!", displayName: "Test Secretary" };
const MEMBER_USER: MockUser = { id: "user-member-agenda", email: "member-agenda@ngc.org", password: "CorrectHorse123!", displayName: "Agenda Member" };

const FUTURE_DEADLINE = "2027-01-01T00:00";

const SEED_DATA = {
  users: [
    { id: SECRETARY.id, email: SECRETARY.email, display_name: SECRETARY.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  user_roles: [{ user_id: SECRETARY.id, role_id: "role-secretary", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-secretary", code: "secretary", name: "Secretary" }],
  role_permissions: [{ role_id: "role-secretary", permission_id: "perm-agenda-manage" }],
  permissions: [{ id: "perm-agenda-manage", code: "management.agenda.manage" }],
  agendas: [],
  votes: [],
  agenda_results: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 10.4: Agenda & Voting", () => {
  test.beforeEach(async () => {
    await seedMockServer([SECRETARY, MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("Secretary creates an agenda item; a member votes and sees their own recorded choice", async ({ page }) => {
    await signIn(page, SECRETARY);
    await page.goto("/agendas");

    await page.getByLabel("Title").fill("Approve the annual budget");
    await page.getByLabel("Voting deadline").fill(FUTURE_DEADLINE);
    await page.getByRole("button", { name: "Create agenda item" }).click();
    await expect(page.getByRole("link", { name: "Approve the annual budget" })).toBeVisible();

    await page.getByRole("link", { name: "Approve the annual budget" }).click();
    await expect(page).toHaveURL(/\/agendas\/.+/);

    const agendaUrl = page.url();

    await page.context().clearCookies();
    await signIn(page, MEMBER_USER);
    await page.goto(agendaUrl);

    await page.getByLabel("Yes").check();
    await page.getByRole("button", { name: "Cast vote" }).click();
    await expect(page.getByText(/You voted\s+Yes/)).toBeVisible();
  });

  test("a plain member sees the always-visible nav link but no creation form or individual-ballots section", async ({ page }) => {
    await seedMockServer(
      [SECRETARY, MEMBER_USER],
      { ...SEED_DATA, agendas: [{ id: "agenda-1", title: "Elect new deputy", voting_method: "yes_no", eligible_voter_scope: "all_members", eligible_user_ids: [], is_anonymous: false, voting_deadline: "2027-01-01T00:00:00.000Z", status: "open", created_by: SECRETARY.id, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }] } as unknown as Parameters<
        typeof seedMockServer
      >[1]
    );

    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Agenda & Voting" })).toBeVisible();

    await page.goto("/agendas");
    await expect(page.getByRole("heading", { name: "New agenda item" })).toHaveCount(0);

    await page.getByRole("link", { name: "Elect new deputy" }).click();
    await expect(page.getByRole("heading", { name: "Individual ballots" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Status" })).toHaveCount(0);
  });
});
