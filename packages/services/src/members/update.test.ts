import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { updateMemberContactInfo } from "./update-contact-info";
import { updateMemberRecord } from "./update-record";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const MEMBER_ROW: FakeRow = {
  id: "member-asha",
  member_number: "NGC-2026-0001",
  first_name: "Asha",
  last_name: "Mwakalinga",
  preferred_name: null,
  photo_url: null,
  membership_status: "active",
  primary_department_id: "dept-sopranos",
  family_id: null,
  joined_at: "2024-01-01",
  phone: null,
  national_id_number: null,
};

test("updateMemberContactInfo updates only self-editable fields", async () => {
  const fake = createFakeSupabaseClient({ members: [MEMBER_ROW], departments: [], families: [] });
  const updated = await updateMemberContactInfo(asClient(fake), "member-asha", { phone: "+255700000001" });
  assert.equal(updated.phone, "+255700000001");
  assert.equal(updated.membershipStatus, "active", "unrelated fields must be untouched");
});

test("updateMemberContactInfo cannot change restricted fields even if a caller bypasses the TypeScript type", async () => {
  const fake = createFakeSupabaseClient({ members: [MEMBER_ROW], departments: [], families: [] });
  // Simulates a caller that bypasses the compile-time restriction (e.g. via
  // `as any`) — the function must still only forward the fields it knows
  // about, never pass an arbitrary payload through to the update.
  const sneaky = { phone: "+255700000002", membership_status: "suspended", member_number: "HACKED" } as any;
  const updated = await updateMemberContactInfo(asClient(fake), "member-asha", sneaky);
  assert.equal(updated.phone, "+255700000002");
  assert.equal(updated.membershipStatus, "active", "membership_status must not be forwarded");
  assert.equal(updated.memberNumber, "NGC-2026-0001", "member_number must not be forwarded");
});

test("updateMemberContactInfo rejects an empty first/last name", async () => {
  const fake = createFakeSupabaseClient({ members: [MEMBER_ROW], departments: [], families: [] });
  await assert.rejects(() => updateMemberContactInfo(asClient(fake), "member-asha", { firstName: "  " }), ServiceError);
});

test("updateMemberRecord (HR path) can change membershipStatus and national ID fields", async () => {
  const fake = createFakeSupabaseClient({ members: [MEMBER_ROW], departments: [], families: [] });
  const updated = await updateMemberRecord(asClient(fake), "member-asha", {
    membershipStatus: "suspended",
    nationalIdNumber: "19900101-00000-00001-01",
  });
  assert.equal(updated.membershipStatus, "suspended");
  assert.equal(updated.nationalIdNumber, "19900101-00000-00001-01");
});
