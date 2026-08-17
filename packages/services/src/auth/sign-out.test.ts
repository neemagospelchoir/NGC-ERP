import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { signOut } from "./sign-out";
import { AuthServiceError } from "./errors";
import { createFakeSupabaseClient } from "./__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("signOut resolves when Supabase reports no error", async () => {
  const fake = createFakeSupabaseClient({ signOut: async () => ({ error: null }) });
  await assert.doesNotReject(() => signOut(asClient(fake)));
});

test("signOut throws AuthServiceError when Supabase reports an error", async () => {
  const fake = createFakeSupabaseClient({ signOut: async () => ({ error: { message: "network down" } }) });
  await assert.rejects(() => signOut(asClient(fake)), AuthServiceError);
});
