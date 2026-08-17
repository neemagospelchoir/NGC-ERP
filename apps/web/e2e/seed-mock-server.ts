const MOCK_SERVER_URL = "http://127.0.0.1:54321";

export interface MockUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
}

export interface MockDataset {
  users?: Record<string, unknown>[];
  members?: Record<string, unknown>[];
  user_roles?: Record<string, unknown>[];
  roles?: Record<string, unknown>[];
  role_permissions?: Record<string, unknown>[];
  permissions?: Record<string, unknown>[];
  departments?: Record<string, unknown>[];
  families?: Record<string, unknown>[];
  member_departments?: Record<string, unknown>[];
  member_families?: Record<string, unknown>[];
  system_settings?: Record<string, unknown>[];
  // Allows a spec to seed any additional table (e.g. a future phase's)
  // without this file needing an update every time.
  [table: string]: Record<string, unknown>[] | undefined;
}

/**
 * Resets e2e/mock-gotrue-server.mjs's in-memory state and re-seeds it for
 * one test. Called from Node (the test runner process), NOT via
 * page.route() — see playwright.config.ts's doc comment for why the mock
 * has to be a real server that apps/web's own Node process talks to.
 */
export async function seedMockServer(users: MockUser[], data: MockDataset): Promise<void> {
  await fetch(`${MOCK_SERVER_URL}/__test__/reset`, { method: "POST" });
  await fetch(`${MOCK_SERVER_URL}/__test__/seed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ users, data }),
  });
}
