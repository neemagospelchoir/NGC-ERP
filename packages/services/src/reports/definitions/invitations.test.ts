import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runInvitationsReport } from "./invitations";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const INVITATIONS: FakeRow[] = [
  {
    id: "inv-1",
    invitation_number: "INV-2026-0001",
    organizer_name: "Grace Fellowship",
    organizer_contact_email: null,
    organizer_contact_phone: null,
    organization_name: null,
    event_name: "Easter Concert",
    event_type: null,
    proposed_date: "2026-04-05",
    proposed_time: null,
    venue: null,
    location: null,
    region: "Dar es Salaam",
    expected_audience: null,
    nature_of_invitation: null,
    performance_requirements: null,
    technical_requirements: null,
    transport_requirements: null,
    accommodation_requirements: null,
    financial_information: null,
    additional_notes: null,
    status: "approved",
    submitted_at: "2026-02-10T00:00:00.000Z",
    created_at: "2026-02-10T00:00:00.000Z",
    updated_at: "2026-02-10T00:00:00.000Z",
  },
  {
    id: "inv-2",
    invitation_number: "INV-2026-0002",
    organizer_name: "Outside the window",
    organizer_contact_email: null,
    organizer_contact_phone: null,
    organization_name: null,
    event_name: "March event",
    event_type: null,
    proposed_date: "2026-03-01",
    proposed_time: null,
    venue: null,
    location: null,
    region: "Mwanza",
    expected_audience: null,
    nature_of_invitation: null,
    performance_requirements: null,
    technical_requirements: null,
    transport_requirements: null,
    accommodation_requirements: null,
    financial_information: null,
    additional_notes: null,
    status: "received",
    submitted_at: "2026-03-01T00:00:00.000Z",
    created_at: "2026-03-01T00:00:00.000Z", // received in March, outside a February report
    updated_at: "2026-03-01T00:00:00.000Z",
  },
];

test("runInvitationsReport includes only invitations received within the resolved period", async () => {
  const fake = createFakeSupabaseClient({ invitations: INVITATIONS });
  const result = await runInvitationsReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.invitationNumber, "INV-2026-0001");
  assert.equal(result.rows[0]?.region, "Dar es Salaam");
});

test("runInvitationsReport narrows further by status", async () => {
  const fake = createFakeSupabaseClient({ invitations: INVITATIONS });
  const result = await runInvitationsReport(asClient(fake), {
    period: { period: "custom", from: "2026-01-01", to: "2026-12-31" },
    status: "received",
  });
  assert.deepEqual(result.rows.map((r) => r.invitationNumber), ["INV-2026-0002"]);
});
