import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { requestPasswordReset, updatePassword } from "./password-reset";
import { AuthServiceError } from "./errors";
import { createFakeSupabaseClient } from "./__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("requestPasswordReset passes the normalized email and redirectTo through", async () => {
  let seen: { email: string; redirectTo: string } | null = null;
  const fake = createFakeSupabaseClient({
    resetPasswordForEmail: async (email, opts) => {
      seen = { email, redirectTo: opts.redirectTo };
      return { error: null };
    },
  });

  await requestPasswordReset(asClient(fake), " Someone@NGC.org ", "https://ngc-erp.example/reset-password");

  assert.deepEqual(seen, {
    email: "someone@ngc.org",
    redirectTo: "https://ngc-erp.example/reset-password",
  });
});

test("requestPasswordReset resolves silently even for a nonexistent account (no enumeration)", async () => {
  // GoTrue itself returns success (no error) for unknown emails; this test
  // documents that this wrapper does not add its own existence check.
  const fake = createFakeSupabaseClient({ resetPasswordForEmail: async () => ({ error: null }) });
  await assert.doesNotReject(() =>
    requestPasswordReset(asClient(fake), "nobody@ngc.org", "https://ngc-erp.example/reset-password")
  );
});

test("requestPasswordReset throws on a genuine transport/config error", async () => {
  const fake = createFakeSupabaseClient({
    resetPasswordForEmail: async () => ({ error: { message: "rate limit exceeded" } }),
  });
  await assert.rejects(
    () => requestPasswordReset(asClient(fake), "someone@ngc.org", "https://ngc-erp.example/reset-password"),
    AuthServiceError
  );
});

test("updatePassword rejects a too-short password before calling Supabase", async () => {
  const fake = createFakeSupabaseClient({
    updateUser: async () => {
      throw new Error("must not be called");
    },
  });
  await assert.rejects(() => updatePassword(asClient(fake), "short"), AuthServiceError);
});

test("updatePassword calls Supabase with a sufficiently long password", async () => {
  let seenPassword = "";
  const fake = createFakeSupabaseClient({
    updateUser: async (attrs) => {
      seenPassword = attrs.password ?? "";
      return { error: null };
    },
  });
  await updatePassword(asClient(fake), "a-long-enough-password");
  assert.equal(seenPassword, "a-long-enough-password");
});
