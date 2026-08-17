import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getApplication, listApplications } from "./list";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function app(overrides: Partial<FakeRow>): FakeRow {
  return {
    id: "app-x",
    application_number: "APP-2026-0001",
    application_type: "new_member",
    access_token_hash: "hash",
    verification_contact: "a@example.com",
    submitted_data: { personal: {}, church: {}, education: {}, professional: {}, choirHistory: {}, musical: {} },
    status: "submitted",
    completion_percentage: 100,
    missing_fields: [],
    reviewed_by: null,
    reviewed_at: null,
    decision_reason: null,
    submitted_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("listApplications filters by status", async () => {
  const fake = createFakeSupabaseClient({
    applications: [
      app({ id: "app-1", status: "submitted" }),
      app({ id: "app-2", status: "approved", application_number: "APP-2026-0002" }),
    ],
  });
  const result = await listApplications(asClient(fake), { status: "approved" });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "app-2");
});

test("listApplications search matches applicant name (derived from submitted_data) or application number", async () => {
  const fake = createFakeSupabaseClient({
    applications: [
      app({ id: "app-1", submitted_data: { personal: { firstName: "Asha", lastName: "Mwakalinga" }, church: {}, education: {}, professional: {}, choirHistory: {}, musical: {} } }),
      app({ id: "app-2", application_number: "APP-2026-0002", submitted_data: { personal: { firstName: "Baraka", lastName: "Kessy" }, church: {}, education: {}, professional: {}, choirHistory: {}, musical: {} } }),
    ],
  });

  const byName = await listApplications(asClient(fake), { search: "asha" });
  assert.equal(byName.length, 1);
  assert.equal(byName[0]?.id, "app-1");

  const byNumber = await listApplications(asClient(fake), { search: "0002" });
  assert.equal(byNumber.length, 1);
  assert.equal(byNumber[0]?.id, "app-2");
});

test("getApplication returns null for an unknown id", async () => {
  const fake = createFakeSupabaseClient({ applications: [app({ id: "app-1" })] });
  const result = await getApplication(asClient(fake), "does-not-exist");
  assert.equal(result, null);
});

test("getApplication returns the full detail including form data", async () => {
  const fake = createFakeSupabaseClient({
    applications: [app({ id: "app-1", submitted_data: { personal: { firstName: "Asha" }, church: {}, education: {}, professional: {}, choirHistory: {}, musical: {} } })],
  });
  const result = await getApplication(asClient(fake), "app-1");
  assert.equal(result?.formData.personal.firstName, "Asha");
});
