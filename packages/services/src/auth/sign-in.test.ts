import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { signInWithPassword } from "./sign-in";
import { AuthServiceError } from "./errors";
import { createFakeSupabaseClient } from "./__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("signInWithPassword returns the userId on success", async () => {
  const fake = createFakeSupabaseClient({
    signInWithPassword: async ({ email, password }) => {
      assert.equal(email, "chorister@ngc.org");
      assert.equal(password, "correct-horse-battery-staple");
      return { data: { user: { id: "user-123" } }, error: null };
    },
  });

  const result = await signInWithPassword(asClient(fake), {
    email: "  Chorister@NGC.org  ",
    password: "correct-horse-battery-staple",
  });

  assert.deepEqual(result, { userId: "user-123" });
});

test("signInWithPassword normalizes email (trim + lowercase) before calling Supabase", async () => {
  let seenEmail = "";
  const fake = createFakeSupabaseClient({
    signInWithPassword: async ({ email }) => {
      seenEmail = email;
      return { data: { user: { id: "user-1" } }, error: null };
    },
  });

  await signInWithPassword(asClient(fake), { email: "  Mixed.Case@NGC.Org ", password: "x".repeat(10) });

  assert.equal(seenEmail, "mixed.case@ngc.org");
});

test("signInWithPassword throws a generic, non-enumerating message on bad credentials", async () => {
  const fake = createFakeSupabaseClient({
    signInWithPassword: async () => ({
      data: { user: null },
      error: { message: "Invalid login credentials", status: 400 },
    }),
  });

  await assert.rejects(
    () => signInWithPassword(asClient(fake), { email: "a@ngc.org", password: "wrong-password" }),
    (err: unknown) => {
      assert.ok(err instanceof AuthServiceError);
      assert.equal(err.message, "Incorrect email or password.");
      return true;
    }
  );
});

test("signInWithPassword rejects empty email/password before calling Supabase", async () => {
  const fake = createFakeSupabaseClient({
    signInWithPassword: async () => {
      throw new Error("must not be called");
    },
  });

  await assert.rejects(() => signInWithPassword(asClient(fake), { email: "", password: "" }), AuthServiceError);
});
