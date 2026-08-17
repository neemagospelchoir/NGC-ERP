import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listMembers, getMember, getMemberByQrToken } from "./list";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const MEMBERS: FakeRow[] = [
  {
    id: "member-asha",
    member_number: "NGC-2026-0001",
    first_name: "Asha",
    last_name: "Mwakalinga",
    preferred_name: null,
    photo_url: null,
    membership_status: "active",
    primary_department_id: "dept-sopranos",
    family_id: "family-david",
    joined_at: "2024-01-01",
    qr_token: "qr-asha-1111",
  },
  {
    id: "member-baraka",
    member_number: "NGC-2026-0002",
    first_name: "Baraka",
    last_name: "Mushi",
    preferred_name: null,
    photo_url: null,
    membership_status: "probation",
    primary_department_id: "dept-altos",
    family_id: null,
    joined_at: null,
    qr_token: "qr-baraka-2222",
  },
];

const DEPARTMENTS: FakeRow[] = [
  { id: "dept-sopranos", name: "Sopranos" },
  { id: "dept-altos", name: "Altos" },
];

const FAMILIES: FakeRow[] = [{ id: "family-david", name: "David Family" }];

function seed() {
  return { members: MEMBERS, departments: DEPARTMENTS, families: FAMILIES };
}

test("listMembers resolves department and family display names", async () => {
  const fake = createFakeSupabaseClient(seed());
  const result = await listMembers(asClient(fake));
  const asha = result.find((m) => m.id === "member-asha");
  assert.equal(asha?.primaryDepartmentName, "Sopranos");
  assert.equal(asha?.familyName, "David Family");

  const baraka = result.find((m) => m.id === "member-baraka");
  assert.equal(baraka?.familyName, null, "a member with no family should not get a name");
});

test("listMembers filters by membership status", async () => {
  const fake = createFakeSupabaseClient(seed());
  const result = await listMembers(asClient(fake), { membershipStatus: "probation" });
  assert.deepEqual(
    result.map((m) => m.id),
    ["member-baraka"]
  );
});

test("listMembers filters by department", async () => {
  const fake = createFakeSupabaseClient(seed());
  const result = await listMembers(asClient(fake), { departmentId: "dept-altos" });
  assert.deepEqual(
    result.map((m) => m.id),
    ["member-baraka"]
  );
});

test("listMembers filters by joined-date range, excluding a member with no joined_at at all", async () => {
  const fake = createFakeSupabaseClient(seed());
  const result = await listMembers(asClient(fake), { joinedFrom: "2023-06-01", joinedTo: "2024-06-01" });
  assert.deepEqual(
    result.map((m) => m.id),
    ["member-asha"],
    "member-baraka has joined_at: null and must not match either bound"
  );
});

test("listMembers searches first/last name case-insensitively", async () => {
  const fake = createFakeSupabaseClient(seed());
  const result = await listMembers(asClient(fake), { search: "mush" });
  assert.deepEqual(
    result.map((m) => m.id),
    ["member-baraka"]
  );
});

test("getMember returns null for an unknown id, and detail with resolved names for a known one", async () => {
  const fake = createFakeSupabaseClient(seed());
  assert.equal(await getMember(asClient(fake), "does-not-exist"), null);

  const detail = await getMember(asClient(fake), "member-asha");
  assert.equal(detail?.primaryDepartmentName, "Sopranos");
  assert.equal(detail?.memberNumber, "NGC-2026-0001");
});

test("getMemberByQrToken resolves a scanned QR token to the matching member, and returns null for an unrecognized one", async () => {
  const fake = createFakeSupabaseClient(seed());

  const resolved = await getMemberByQrToken(asClient(fake), "qr-baraka-2222");
  assert.equal(resolved?.id, "member-baraka");
  assert.equal(resolved?.memberNumber, "NGC-2026-0002");

  assert.equal(
    await getMemberByQrToken(asClient(fake), "not-a-real-token"),
    null,
    "an unrecognized token must fail closed, not throw"
  );
});
