import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 14.3 (QA — accessibility audit). PRD §12's Non-Functional
 * Requirements name "keyboard navigation, screen-reader labeling, color
 * contrast, semantic HTML" as this project's accessibility bar (no
 * specific WCAG level is cited) — this suite uses WCAG 2.1 A + AA as the
 * industry-standard, automatable proxy for that bar, via axe-core (the
 * same engine most real-world accessibility audits and CI gates use).
 *
 * SCOPE: a smoke-level automated scan, not exhaustive per-page coverage of
 * all ~40 pages in this app — chosen to maximize how much of the shared
 * component library (`packages/ui`) and shell chrome (Sidebar/PageHeader/
 * the (erp) layout's header+main) gets exercised per page scanned:
 *   - `/login` (public, unauthenticated) — the one page every visitor,
 *     including a screen-reader user who has never signed in, must reach.
 *   - `/style-guide` (public) — showcases nearly every `packages/ui`
 *     component in one page (buttons, inputs incl. an error state,
 *     checkboxes/radios, a populated/loading/empty table, status
 *     pills/badges, empty/error states), scanned both closed and with its
 *     Modal open (a modal has its own focus-trap/labelling requirements
 *     axe checks independently of the page around it).
 *   - `/dashboard` (authenticated) — the one page every signed-in session
 *     reaches, exercising the real (erp) layout shell (Sidebar nav,
 *     header, main landmark) that every other module page shares, not
 *     just the style guide's standalone demo of the same components.
 *
 * A regression here — a missing form label, a button losing its
 * accessible name, a contrast ratio slipping below AA — would previously
 * have gone completely uncaught by CI, the same gap 14.2's DB smoke tests
 * closed for RLS/triggers (see docs/PHASE_14_2.md).
 */
const DASHBOARD_USER: MockUser = {
  id: "user-a11y-dashboard",
  email: "a11y-dashboard@ngc.org",
  password: "CorrectHorse123!",
  displayName: "Accessibility Audit Member",
};

const SEED_DATA = {
  users: [{ id: DASHBOARD_USER.id, email: DASHBOARD_USER.email, display_name: DASHBOARD_USER.displayName, is_active: true }],
  members: [
    {
      id: "member-a11y-1",
      user_id: DASHBOARD_USER.id,
      member_number: "NGC-2026-A11Y",
      first_name: "Accessibility",
      last_name: "Audit",
      membership_status: "active",
      primary_department_id: null,
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

/**
 * WCAG 2.1 A + AA only — not "best-practice" rules, which axe tags
 * separately and which include many stylistic preferences PRD §12 doesn't
 * actually commit this project to.
 */
function scoped(page: Page) {
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
}

test.describe("Phase 14.3 accessibility audit (axe-core, WCAG 2.1 A/AA)", () => {
  test.beforeEach(async () => {
    await seedMockServer([DASHBOARD_USER], SEED_DATA);
  });

  test("/login has no WCAG 2.1 A/AA violations", async ({ page }) => {
    await page.goto("/login");
    const results = await scoped(page).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("/style-guide (closed state) has no WCAG 2.1 A/AA violations", async ({ page }) => {
    await page.goto("/style-guide");
    const results = await scoped(page).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("/style-guide with the Modal open has no WCAG 2.1 A/AA violations", async ({ page }) => {
    await page.goto("/style-guide");
    await page.getByRole("button", { name: "Open approval confirmation" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const results = await scoped(page).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("/dashboard (authenticated, real (erp) layout shell) has no WCAG 2.1 A/AA violations", async ({ page }) => {
    await signIn(page, DASHBOARD_USER);
    const results = await scoped(page).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("the (erp) layout provides a skip link to bypass the primary nav", async ({ page }) => {
    // WCAG 2.1 SC 2.4.1 (Bypass Blocks, Level A): a keyboard user must be
    // able to reach main content without tabbing through the entire
    // primary nav on every single page. Tab once from the top of the page
    // and expect a "Skip to main content" link to be the first focus stop.
    await signIn(page, DASHBOARD_USER);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  });
});
