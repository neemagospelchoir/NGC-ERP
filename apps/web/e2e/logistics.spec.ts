import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 8.5 (Logistics) end-to-end verification. Covers: a Logistics
 * Officer creating a trip for an event, editing its details, generating an
 * itinerary (assigned members + notes), editing that itinerary afterward,
 * and confirming a plain member can still read the trip and itinerary
 * (`trips_select_internal`/`itineraries_select_internal` RLS allows any
 * signed-in user) but sees no edit/generate controls.
 */
const LOGISTICS_OFFICER: MockUser = { id: "user-logistics-2", email: "logistics-2@ngc.org", password: "CorrectHorse123!", displayName: "Logistics Officer" };
const MEMBER_USER: MockUser = { id: "user-member-13", email: "member-logistics@ngc.org", password: "CorrectHorse123!", displayName: "Furaha Member" };

const SEED_DATA = {
  users: [
    { id: LOGISTICS_OFFICER.id, email: LOGISTICS_OFFICER.email, display_name: LOGISTICS_OFFICER.displayName, is_active: true },
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
  ],
  user_roles: [{ user_id: LOGISTICS_OFFICER.id, role_id: "role-logistics-2", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-logistics-2", code: "logistics_officer", name: "Logistics Officer" }],
  role_permissions: [{ role_id: "role-logistics-2", permission_id: "perm-trips-manage" }],
  permissions: [{ id: "perm-trips-manage", code: "logistics.trips.manage" }],
  events: [{ id: "event-3", name: "Regional Crusade", event_date: "2026-12-10", status: "scheduled" }],
  trips: [],
  itineraries: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 8.5: Logistics", () => {
  test.beforeEach(async () => {
    await seedMockServer([LOGISTICS_OFFICER, MEMBER_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("Logistics Officer creates a trip, edits it, generates an itinerary, and edits it; a plain member can still read both", async ({ page }) => {
    await signIn(page, LOGISTICS_OFFICER);
    await page.goto("/trips");

    await page.getByLabel("Event ID").fill("event-3");
    await page.getByLabel("Destination").fill("Mwanza");
    await page.getByLabel("Currency").fill("TZS");
    await page.getByRole("button", { name: "Create trip" }).click();
    await expect(page.getByRole("link", { name: "Mwanza" })).toBeVisible();

    await page.getByRole("link", { name: "Mwanza" }).click();
    await expect(page).toHaveURL(/\/trips\/.+/);
    const tripUrl = page.url();

    await page.getByLabel("Driver name").fill("Juma Hassan");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByLabel("Driver name")).toHaveValue("Juma Hassan");

    await expect(page.getByText("No itinerary generated yet for this trip.")).toBeVisible();
    await page.getByLabel("Assigned members (member IDs)").fill("member-1,member-2");
    await page.getByRole("button", { name: "Generate itinerary" }).click();
    await expect(page.getByText("member-1, member-2")).toBeVisible();

    await page.getByLabel("Assigned members (member IDs)").fill("member-1,member-2,member-3");
    await page.getByRole("button", { name: "Save itinerary" }).click();
    await expect(page.getByText("member-1, member-2, member-3")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Trips" })).toBeVisible();
    await page.goto(tripUrl);
    await expect(page.getByText("Juma Hassan")).toBeVisible();
    await expect(page.getByText("member-1, member-2, member-3")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save itinerary" })).toHaveCount(0);
  });
});
