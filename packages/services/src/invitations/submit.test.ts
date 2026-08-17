import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { submitInvitation } from "./submit";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient(
    {
      system_settings: [{ id: "s1", setting_key: "id_format.invitation_number", value: "INV-{year}-{sequence}" }],
      invitations: [],
    },
    {
      rpcStubs: {
        next_formatted_id: async () => ({ data: "INV-2026-0001", error: null }),
      },
    }
  );
}

test("submitInvitation creates a submitted invitation and returns a one-time access token", async () => {
  const fake = seed();
  const result = await submitInvitation(asClient(fake), {
    organizerName: "AICT Kinondoni",
    eventName: "Crown TV Recording",
    proposedDate: "2026-03-01",
    verificationContact: "organizer@church.org",
  });
  assert.equal(result.invitationNumber, "INV-2026-0001");
  assert.ok(result.accessToken.length > 10);

  const rows = fake.__db.get("invitations") ?? [];
  assert.equal(rows[0]?.status, "submitted");
  assert.ok(rows[0]?.submitted_at);
  assert.notEqual(rows[0]?.access_token_hash, result.accessToken); // only the hash persists
});

test("submitInvitation requires organizer name, event name, proposed date, and a verification contact", async () => {
  const fake = seed();
  await assert.rejects(
    () => submitInvitation(asClient(fake), { organizerName: "", eventName: "X", proposedDate: "2026-03-01", verificationContact: "a@b.com" }),
    /organizer's name/
  );
  await assert.rejects(
    () => submitInvitation(asClient(fake), { organizerName: "X", eventName: "", proposedDate: "2026-03-01", verificationContact: "a@b.com" }),
    /event name/
  );
  await assert.rejects(
    () => submitInvitation(asClient(fake), { organizerName: "X", eventName: "Y", proposedDate: "", verificationContact: "a@b.com" }),
    /proposed event date/
  );
  await assert.rejects(
    () => submitInvitation(asClient(fake), { organizerName: "X", eventName: "Y", proposedDate: "2026-03-01", verificationContact: "" }),
    /email address or phone number/
  );
});
