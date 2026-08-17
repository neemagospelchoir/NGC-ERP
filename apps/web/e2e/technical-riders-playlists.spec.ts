import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 8.4 (Technical Rider & Playlist) end-to-end verification. Covers:
 * a Technical Manager creating a technical rider for an event and editing
 * it afterward, a plain member (with no technical permissions at all)
 * still being able to read that same rider — `technical_riders_select_
 * internal` RLS (0009) allows any signed-in user, matching the always-
 * visible nav treatment — and a Technical Manager creating a playlist,
 * adding a song, editing it, and removing it, plus confirming a plain
 * member who is NOT a participant on that event sees an empty Playlists
 * page (RLS-scoped, not permission-gated) while a member who IS a
 * participant can read the playlist's songs but sees no management
 * actions.
 */
const TECH_MANAGER: MockUser = { id: "user-tech-2", email: "tech-manager-2@ngc.org", password: "CorrectHorse123!", displayName: "Technical Manager" };
const PARTICIPANT_MEMBER: MockUser = { id: "user-member-11", email: "participant@ngc.org", password: "CorrectHorse123!", displayName: "Neema Participant" };
const OUTSIDER_MEMBER: MockUser = { id: "user-member-12", email: "outsider@ngc.org", password: "CorrectHorse123!", displayName: "Baraka Outsider" };

const SEED_DATA = {
  users: [
    { id: TECH_MANAGER.id, email: TECH_MANAGER.email, display_name: TECH_MANAGER.displayName, is_active: true },
    { id: PARTICIPANT_MEMBER.id, email: PARTICIPANT_MEMBER.email, display_name: PARTICIPANT_MEMBER.displayName, is_active: true },
    { id: OUTSIDER_MEMBER.id, email: OUTSIDER_MEMBER.email, display_name: OUTSIDER_MEMBER.displayName, is_active: true },
  ],
  members: [
    {
      id: "member-participant-1",
      user_id: PARTICIPANT_MEMBER.id,
      member_number: "NGC-2026-0011",
      first_name: "Neema",
      last_name: "Participant",
      membership_status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "member-outsider-1",
      user_id: OUTSIDER_MEMBER.id,
      member_number: "NGC-2026-0012",
      first_name: "Baraka",
      last_name: "Outsider",
      membership_status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  user_roles: [{ user_id: TECH_MANAGER.id, role_id: "role-tech-2", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-tech-2", code: "technical_manager", name: "Technical Manager" }],
  role_permissions: [
    { role_id: "role-tech-2", permission_id: "perm-riders-manage" },
    { role_id: "role-tech-2", permission_id: "perm-playlists-manage" },
  ],
  permissions: [
    { id: "perm-riders-manage", code: "technical.riders.manage" },
    { id: "perm-playlists-manage", code: "technical.playlists.manage" },
  ],
  events: [{ id: "event-2", name: "Easter Concert", event_date: "2026-12-25", status: "scheduled" }],
  event_participants: [{ id: "ep-1", event_id: "event-2", member_id: "member-participant-1", assignment_source: "manual" }],
  technical_riders: [],
  playlists: [],
  playlist_items: [],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 8.4: Technical Rider & Playlist", () => {
  test.beforeEach(async () => {
    await seedMockServer(
      [TECH_MANAGER, PARTICIPANT_MEMBER, OUTSIDER_MEMBER],
      SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]
    );
  });

  test("Technical Manager creates and edits a technical rider; a plain member can still read it", async ({ page }) => {
    await signIn(page, TECH_MANAGER);
    await page.goto("/technical-riders");

    await page.getByLabel("Event ID").fill("event-2");
    await page.getByLabel("PA requirements").fill("2x line array, 4x monitor wedges");
    await page.getByRole("button", { name: "Create technical rider" }).click();
    await expect(page.getByRole("link", { name: "event-2" })).toBeVisible();

    await page.getByRole("link", { name: "event-2" }).click();
    await expect(page).toHaveURL(/\/technical-riders\/.+/);
    const riderUrl = page.url();
    await expect(page.getByLabel("PA requirements")).toHaveValue("2x line array, 4x monitor wedges");

    await page.getByLabel("Lighting requirements").fill("Full wash + 2 spotlights");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByLabel("Lighting requirements")).toHaveValue("Full wash + 2 spotlights");

    // A plain member (no technical.riders.manage) can still read the rider —
    // `technical_riders_select_internal` RLS allows any signed-in user.
    await page.context().clearCookies();
    await signIn(page, OUTSIDER_MEMBER);
    await expect(page.getByRole("link", { name: "Technical Riders" })).toBeVisible();
    await page.goto(riderUrl);
    await expect(page.getByText("2x line array, 4x monitor wedges")).toBeVisible();
    await expect(page.getByText("Full wash + 2 spotlights")).toBeVisible();
  });

  test("Technical Manager creates a playlist, adds/edits/removes a song; participation scopes read access", async ({ page }) => {
    await signIn(page, TECH_MANAGER);
    await page.goto("/playlists");

    await page.getByLabel("Event ID").fill("event-2");
    await page.getByRole("button", { name: "Create playlist" }).click();
    await expect(page.getByRole("link", { name: "Event Playlist" })).toBeVisible();

    await page.getByRole("link", { name: "Event Playlist" }).click();
    await expect(page).toHaveURL(/\/playlists\/.+/);
    const playlistUrl = page.url();

    await page.getByLabel("Song title").fill("Amazing Grace");
    await page.getByLabel("Key").fill("G");
    await page.getByRole("button", { name: "Add song" }).click();
    await expect(page.getByText(/Amazing Grace/)).toBeVisible();

    const songItem = page.locator("li").filter({ hasText: "Amazing Grace" });
    await songItem.getByText("Edit / remove").click();
    await songItem.getByLabel("Song title").fill("How Great Thou Art");
    await songItem.getByRole("button", { name: "Save song" }).click();
    await expect(page.getByText(/How Great Thou Art/)).toBeVisible();

    // A participant member (not a manager) can read the playlist's songs
    // but sees no edit/remove/add controls.
    await page.context().clearCookies();
    await signIn(page, PARTICIPANT_MEMBER);
    await expect(page.getByRole("link", { name: "Playlists" })).toBeVisible();
    await page.goto(playlistUrl);
    await expect(page.getByText(/How Great Thou Art/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add song" })).toHaveCount(0);

    // An outsider (not a participant, no manage permission) sees no
    // playlists at all on the list page — RLS-scoped, not permission-gated.
    await page.context().clearCookies();
    await signIn(page, OUTSIDER_MEMBER);
    await page.goto("/playlists");
    await expect(page.getByText("No playlists yet")).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, TECH_MANAGER);
    await page.goto(playlistUrl);
    await page.getByText("Edit / remove").click();
    await page.getByRole("button", { name: "Remove this song" }).click();
    await expect(page.getByText("No songs added yet.")).toBeVisible();
  });
});
