import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { assignDepartment, endDepartmentAssignment } from "./assign-department";
import { assignFamily } from "./assign-family";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(): Record<string, FakeRow[]> {
  return {
    members: [{ id: "member-asha", primary_department_id: "dept-sopranos", family_id: null }],
    member_departments: [
      {
        id: "assignment-1",
        member_id: "member-asha",
        department_id: "dept-sopranos",
        assignment_type: "primary",
        is_current: true,
        ended_at: null,
      },
    ],
    member_families: [],
  };
}

test("assignDepartment (primary) closes the previous assignment, logs the new one, and updates members.primary_department_id", async () => {
  const fake = createFakeSupabaseClient(seed());

  await assignDepartment(asClient(fake), {
    memberId: "member-asha",
    departmentId: "dept-tenors",
    assignmentType: "primary",
    changedBy: "user-hr-1",
  });

  const history = fake.__db.get("member_departments") ?? [];
  const closed = history.find((r) => r.id === "assignment-1");
  assert.equal(closed?.is_current, false);
  assert.ok(closed?.ended_at, "closed assignment should get an ended_at timestamp");

  const newCurrent = history.find((r) => r.department_id === "dept-tenors" && r.is_current === true);
  assert.ok(newCurrent, "a new current primary assignment row should exist");
  assert.equal(newCurrent?.changed_by, "user-hr-1");

  const member = (fake.__db.get("members") ?? []).find((m) => m.id === "member-asha");
  assert.equal(member?.primary_department_id, "dept-tenors");
});

test("assignDepartment (secondary) does not close existing primary or touch members.primary_department_id", async () => {
  const fake = createFakeSupabaseClient(seed());

  await assignDepartment(asClient(fake), {
    memberId: "member-asha",
    departmentId: "dept-media",
    assignmentType: "secondary",
    changedBy: "user-hr-1",
  });

  const history = fake.__db.get("member_departments") ?? [];
  const originalPrimary = history.find((r) => r.id === "assignment-1");
  assert.equal(originalPrimary?.is_current, true, "the primary assignment must be untouched by a secondary change");

  const member = (fake.__db.get("members") ?? []).find((m) => m.id === "member-asha");
  assert.equal(member?.primary_department_id, "dept-sopranos", "primary department must be unchanged");
});

test("endDepartmentAssignment marks a specific assignment row as no longer current", async () => {
  const fake = createFakeSupabaseClient(seed());
  await endDepartmentAssignment(asClient(fake), "assignment-1");
  const row = (fake.__db.get("member_departments") ?? []).find((r) => r.id === "assignment-1");
  assert.equal(row?.is_current, false);
});

test("assignFamily closes the previous current family, logs the new one, and updates members.family_id", async () => {
  const fake = createFakeSupabaseClient(seed());

  await assignFamily(asClient(fake), { memberId: "member-asha", familyId: "family-david", changedBy: "user-hr-1" });

  const history = fake.__db.get("member_families") ?? [];
  const newCurrent = history.find((r) => r.family_id === "family-david" && r.is_current === true);
  assert.ok(newCurrent);

  const member = (fake.__db.get("members") ?? []).find((m) => m.id === "member-asha");
  assert.equal(member?.family_id, "family-david");
});
