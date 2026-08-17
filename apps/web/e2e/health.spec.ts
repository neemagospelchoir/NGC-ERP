import { test, expect } from "@playwright/test";
import { seedMockServer } from "./seed-mock-server";

/**
 * Phase 15 (Deployment). Verifies /api/health (apps/web/app/api/health/
 * route.ts) — the endpoint an external uptime monitor pings per
 * ARCHITECTURE.md §17 — is reachable with NO Supabase session at all (an
 * external monitor never has one) and reports a real database round-trip,
 * against a real running Next.js server (not a unit-test mock of the route
 * handler itself), matching this suite's own established pattern of
 * exercising real middleware.ts + real Route Handlers end-to-end.
 */
test.describe("Phase 15: /api/health", () => {
  test.beforeEach(async () => {
    await seedMockServer([], {});
  });

  test("is reachable without any session and reports the database as reachable", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("reachable");
  });

  test("is exempt from middleware's auth redirect (unlike every (erp) page)", async ({ page }) => {
    // A direct navigation (not just an API fetch) must not be redirected to
    // /login the way an unauthenticated visit to e.g. /dashboard is —
    // confirms /api/health is genuinely in middleware.ts's PUBLIC_PATHS,
    // not merely reachable by coincidence of route-matching order.
    const response = await page.goto("/api/health");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/api\/health/);
  });
});
