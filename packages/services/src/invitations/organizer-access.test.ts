import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getInvitationForOrganizer, resubmitInvitation } from "./organizer-access";
import { hashToken } from "./token";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

async function seed(status = "pending_information") {
  const tokenHash = await hashToken("correct-token");
  return createFakeSupabaseClient({
    invitations: [
      {
        id: "inv-1",
        invitation_number: "INV-2026-0001",
        organizer_name: "AICT Kinondoni",
        organizer_contact_email: null,
        organizer_contact_phone: null,
        organization_name: null,
        event_name: "Crown TV Recording",
        event_type: null,
        proposed_date: "2026-03-01",
        proposed_time: null,
        venue: null,
        location: null,
        region: null,
        expected_audience: null,
        nature_of_invitation: null,
        performance_requirements: null,
        technical_requirements: null,
        transport_requirements: null,
        accommodation_requirements: null,
        financial_information: null,
        additional_notes: null,
        access_token_hash: tokenHash,
        verification_contact: "organizer@church.org",
        status,
        submitted_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    comments: [
      { id: "c1", owner_type: "invitation", owner_id: "inv-1", author_id: "user-hr", body: "Internal only.", is_internal: true, created_at: "2026-01-02T00:00:00.000Z", updated_at: "2026-01-02T00:00:00.000Z" },
      { id: "c2", owner_type: "invitation", owner_id: "inv-1", author_id: "user-hr", body: "Please clarify venue.", is_internal: false, created_at: "2026-01-02T00:00:00.000Z", updated_at: "2026-01-02T00:00:00.000Z" },
    ],
  });
}

test("getInvitationForOrganizer returns the invitation and only organizer-visible comments", async () => {
  const fake = await seed();
  const result = await getInvitationForOrganizer(asClient(fake), {
    invitationNumber: "INV-2026-0001",
    accessToken: "correct-token",
    verificationContact: "organizer@church.org",
  });
  assert.equal(result.invitation.eventName, "Crown TV Recording");
  assert.equal(result.visibleComments.length, 1);
  assert.equal(result.visibleComments[0]?.body, "Please clarify venue.");
});

test("getInvitationForOrganizer fails with a generic error on a wrong token, contact, or number — not distinguishable", async () => {
  const fake = await seed();
  const base = { invitationNumber: "INV-2026-0001", accessToken: "correct-token", verificationContact: "organizer@church.org" };

  let wrongToken: string | undefined;
  let wrongContact: string | undefined;
  let wrongNumber: string | undefined;
  try {
    await getInvitationForOrganizer(asClient(fake), { ...base, accessToken: "wrong" });
  } catch (e) {
    wrongToken = (e as Error).message;
  }
  try {
    await getInvitationForOrganizer(asClient(fake), { ...base, verificationContact: "someone@else.com" });
  } catch (e) {
    wrongContact = (e as Error).message;
  }
  try {
    await getInvitationForOrganizer(asClient(fake), { ...base, invitationNumber: "INV-2026-9999" });
  } catch (e) {
    wrongNumber = (e as Error).message;
  }
  assert.ok(wrongToken && wrongToken === wrongContact && wrongContact === wrongNumber);
});

test("resubmitInvitation moves pending_information back to submitted and applies the patch", async () => {
  const fake = await seed("pending_information");
  const result = await resubmitInvitation(
    asClient(fake),
    { invitationNumber: "INV-2026-0001", accessToken: "correct-token", verificationContact: "organizer@church.org" },
    { venue: "Chang'ombe Church" }
  );
  assert.equal(result.status, "submitted");
  assert.equal(result.venue, "Chang'ombe Church");
  assert.equal(result.eventName, "Crown TV Recording"); // untouched fields preserved
});

test("resubmitInvitation refuses when the invitation isn't in pending_information", async () => {
  const fake = await seed("under_review");
  await assert.rejects(
    () =>
      resubmitInvitation(
        asClient(fake),
        { invitationNumber: "INV-2026-0001", accessToken: "correct-token", verificationContact: "organizer@church.org" },
        {}
      ),
    /isn't awaiting more information/
  );
});
