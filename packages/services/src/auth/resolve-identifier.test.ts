import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { resolveLoginIdentifier } from "./resolve-identifier";
import { createFakeSupabaseClient } from "./__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("resolveLoginIdentifier passes an email-shaped identifier straight through, lowercased", async () => {
  const fake = createFakeSupabaseClient({}, { users: [] });

  const result = await resolveLoginIdentifier(asClient(fake), "  Someone@NGC.org ");

  assert.equal(result, "someone@ngc.org");
});

test("resolveLoginIdentifier resolves a known username to its email", async () => {
  const fake = createFakeSupabaseClient(
    {},
    { users: [{ id: "u1", username: "chorister1", email: "chorister1@ngc.org" }] }
  );

  const result = await resolveLoginIdentifier(asClient(fake), "chorister1");

  assert.equal(result, "chorister1@ngc.org");
});

test("resolveLoginIdentifier returns the original text unchanged for an unknown username (no enumeration leak)", async () => {
  const fake = createFakeSupabaseClient({}, { users: [] });

  const result = await resolveLoginIdentifier(asClient(fake), "nobody-uses-this-handle");

  assert.equal(result, "nobody-uses-this-handle");
});
