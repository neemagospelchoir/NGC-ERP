import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 10.3 (Communications: Calendar) end-to-end verification. Calendar
 * is a pure read-side aggregation of three pre-existing sources (events,
 * attendance_sessions, contribution_campaigns) — there is nothing to
 * create/edit/delete here, so this spec covers a plain member seeing the
 * always-visible Calendar nav link, the merged agenda for a fixed month
 * (`?month=` is used throughout so the test is not sensitive to whatever
 * date it actually runs on), the type filter, and month navigation.
 */
const MEMBER_USER: MockUser = { id: "user-member-cal", email: "member-cal@ngc.org", password: "CorrectHorse123!", displayName: "Calendar Member" };

const SEED_DATA = {
  users: [{ id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true }],
  events: [
    {
      id: "event-cal-1",
      invitation_id: null,
      name: "City Crusade",
      event_category: "community_outreach",
      event_date: "2026-03-10",
      status: "confirmed",
      qr_token: "qr-cal-1",
    },
  ],
  attendance_sessions: [
    {
      id: "session-cal-1",
      session_type: "rehearsal",
      title: "Weekly rehearsal",
      department_id: null,
      event_id: null,
      session_date: "2026-03-05",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  contribution_campaigns: [
    {
      id: "campaign-cal-1",
      name: "Building Fund",
      target_amount: 1000,
      currency: "TZS",
      deadline: "2026-03-20",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 10.3: Calendar", () => {
  test.beforeEach(async () => {
    await seedMockServer([MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("a plain member sees the always-visible Calendar nav link and the merged agenda for the month", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Calendar" })).toBeVisible();

    await page.goto("/calendar?month=2026-03");
    await expect(page.getByRole("heading", { name: "March 2026" })).toBeVisible();
    await expect(page.getByRole("link", { name: "City Crusade" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Weekly rehearsal" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Building Fund/ })).toBeVisible();
  });

  test("an empty month shows the empty state, and the type filter narrows the agenda", async ({ page }) => {
    await signIn(page, MEMBER_USER);

    await page.goto("/calendar?month=2026-06");
    await expect(page.getByText("Nothing on the calendar")).toBeVisible();

    await page.goto("/calendar?month=2026-03&types=event");
    await expect(page.getByRole("link", { name: "City Crusade" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Weekly rehearsal" })).toHaveCount(0);
  });
});
