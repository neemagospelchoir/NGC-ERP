import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { signUpWithPassword } from "./sign-up";
import { AuthServiceError } from "./errors";
import { createFakeSupabaseClient } from "./__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("signUpWithPassword returns userId + confirmedImmediately=true when Supabase returns a session", async () => {
  const fake = createFakeSupabaseClient({
    signUp: async ({ email, password, options }) => {
      assert.equal(email, "new.member@ngc.org");
      assert.equal(password, "correct-horse-battery-staple");
      assert.deepEqual(options?.data, { display_name: "New Member", username: "newmember" });
      return { data: { user: { id: "user-new-1" }, session: { access_token: "tok" } }, error: null };
    },
  });

  const result = await signUpWithPassword(asClient(fake), {
    email: "  New.Member@NGC.org ",
    password: "correct-horse-battery-staple",
    displayName: "New Member",
    username: "newmember",
  });

  assert.deepEqual(result, { userId: "user-new-1", confirmedImmediately: true });
});

test("signUpWithPassword returns confirmedImmediately=false when Supabase returns no session (email confirmation pending)", async () => {
  const fake = createFakeSupabaseClient({
    signUp: async () => ({ data: { user: { id: "user-new-2" }, session: null }, error: null }),
  });

  const result = await signUpWithPassword(asClient(fake), {
    email: "pending@ngc.org",
    password: "correct-horse-battery-staple",
    displayName: "Pending Person",
  });

  assert.deepEqual(result, { userId: "user-new-2", confirmedImmediately: false });
});

test("signUpWithPassword passes null (not undefined) for an omitted username", async () => {
  let seenUsername: unknown = "not-set";
  const fake = createFakeSupabaseClient({
    signUp: async ({ options }) => {
      seenUsername = options?.data?.username;
      return { data: { user: { id: "user-3" }, session: null }, error: null };
    },
  });

  await signUpWithPassword(asClient(fake), {
    email: "no-username@ngc.org",
    password: "correct-horse-battery-staple",
    displayName: "No Username",
  });

  assert.equal(seenUsername, null);
});

test("signUpWithPassword rejects a password under 8 characters before calling Supabase", async () => {
  const fake = createFakeSupabaseClient({
    signUp: async () => {
      throw new Error("must not be called");
    },
  });

  await assert.rejects(
    () =>
      signUpWithPassword(asClient(fake), {
        email: "a@ngc.org",
        password: "short",
        displayName: "A",
      }),
    AuthServiceError
  );
});

test("signUpWithPassword rejects a malformed username before calling Supabase", async () => {
  const fake = createFakeSupabaseClient({
    signUp: async () => {
      throw new Error("must not be called");
    },
  });

  await assert.rejects(
    () =>
      signUpWithPassword(asClient(fake), {
        email: "a@ngc.org",
        password: "correct-horse-battery-staple",
        displayName: "A",
        username: "no spaces allowed",
      }),
    AuthServiceError
  );
});

test("signUpWithPassword surfaces a safe message when the email is already registered", async () => {
  const fake = createFakeSupabaseClient({
    signUp: async () => ({
      data: { user: null, session: null },
      error: { message: "User already registered", status: 422 },
    }),
  });

  await assert.rejects(
    () =>
      signUpWithPassword(asClient(fake), {
        email: "existing@ngc.org",
        password: "correct-horse-battery-staple",
        displayName: "Existing",
      }),
    (err: unknown) => {
      assert.ok(err instanceof AuthServiceError);
      assert.match(err.message, /already exists/i);
      return true;
    }
  );
});
