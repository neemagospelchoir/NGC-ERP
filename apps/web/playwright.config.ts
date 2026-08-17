import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// This development sandbox pins a specific pre-installed Chromium build and
// blocks `playwright install` from fetching a matching one for whatever
// @playwright/test version is in package.json, so local runs here must
// point at that exact binary. A normal CI runner (see the commented-out
// job stub in .github/workflows/ci.yml) would instead run
// `playwright install --with-deps` and use Playwright's own default
// resolution — so this override only applies when that sandbox path
// actually exists, keeping this config portable.
const SANDBOX_CHROMIUM_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const sandboxChromiumExists = existsSync(SANDBOX_CHROMIUM_PATH);

/**
 * Verifies the Phase 6 auth flow against a REAL running Next.js server
 * (real middleware.ts, real Server Actions, real Route Handlers, real
 * @ngc/services/auth code) with a REAL second Node process
 * (e2e/mock-gotrue-server.mjs) standing in for Supabase Auth + PostgREST.
 *
 * This is a genuine HTTP server, not a Playwright page.route() browser
 * intercept — middleware.ts and every Server Action/Route Handler execute
 * server-side and call Supabase directly from the Next.js Node process,
 * never through the browser, so only a real listener on
 * NEXT_PUBLIC_SUPABASE_URL can answer those calls. See
 * e2e/mock-gotrue-server.mjs's doc comment and docs/AUTHENTICATION.md
 * "Environment constraints" for why this substitutes for a real hosted
 * Supabase project (its Docker images are on registries this sandbox's
 * network policy blocks).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/mock-gotrue-server.mjs",
      url: "http://127.0.0.1:54321/__test__/health",
      reuseExistingServer: false,
      timeout: 20_000,
    },
    {
      command: "pnpm start -p 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(sandboxChromiumExists ? { launchOptions: { executablePath: SANDBOX_CHROMIUM_PATH } } : {}),
      },
    },
  ],
});
