import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { advanceInvitationStatus, requestInvitationInformation, cancelInvitation } from "./review";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(status = "submitted") {
  return createFakeSupabaseClient({
    invitations: [
      {
        id: "inv-1",
        invitation_number: "INV-2026-0001",
        organizer_name: "AICT Kinondoni",
        event_name: "Crown TV Recording",
        proposed_date: "2026-03-01",
        access_token_hash: "hash",
        verification_contact: "organizer@church.org",
        status,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    comments: [],
  });
}

test("advanceInvitationStatus walks submitted -> received -> under_review", async () => {
  const fake = seed("submitted");
  await advanceInvitationStatus(asClient(fake), "inv-1", "received");
  const result = await advanceInvitationStatus(asClient(fake), "inv-1", "under_review");
  assert.equal(result.status, "under_review");
});

test("advanceInvitationStatus refuses an illegal jump", async () => {
  const fake = seed("submitted");
  await assert.rejects(() => advanceInvitationStatus(asClient(fake), "inv-1", "completed"), /Cannot move an invitation/);
});

test("requestInvitationInformation moves to pending_information and posts an organizer-visible comment", async () => {
  const fake = seed("under_review");
  const result = await requestInvitationInformation(asClient(fake), "inv-1", { requestedBy: "user-hr", note: "Please share the venue address." });
  assert.equal(result.status, "pending_information");

  const comments = fake.__db.get("comments") ?? [];
  assert.equal(comments.length, 1);
  assert.equal(comments[0]?.is_internal, false);
});

test("requestInvitationInformation requires a non-blank note", async () => {
  const fake = seed("under_review");
  await assert.rejects(() => requestInvitationInformation(asClient(fake), "inv-1", { requestedBy: "user-hr", note: "  " }));
});

test("cancelInvitation cancels from a non-terminal status and records a reason", async () => {
  const fake = seed("under_review");
  const result = await cancelInvitation(asClient(fake), "inv-1", { cancelledBy: "user-secretary", reason: "Organizer withdrew." });
  assert.equal(result.status, "cancelled");
});

test("cancelInvitation refuses once already completed", async () => {
  const fake = seed("completed");
  await assert.rejects(() => cancelInvitation(asClient(fake), "inv-1", { cancelledBy: "user-secretary", reason: "Too late." }));
});
