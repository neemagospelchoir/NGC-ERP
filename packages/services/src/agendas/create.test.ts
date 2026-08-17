import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createAgenda } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const DEADLINE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

test("createAgenda creates an open, all-members, non-anonymous agenda by default", async () => {
  const fake = createFakeSupabaseClient({ agendas: [] });
  const agenda = await createAgenda(asClient(fake), {
    title: "Approve annual budget",
    votingDeadline: DEADLINE,
    createdBy: "user-secretary",
  });
  assert.equal(agenda.title, "Approve annual budget");
  assert.equal(agenda.status, "open");
  assert.equal(agenda.eligibleVoterScope, "all_members");
  assert.equal(agenda.isAnonymous, false);
  assert.equal(agenda.votingMethod, "yes_no_abstain");
  assert.equal(agenda.createdBy, "user-secretary");
});

test("createAgenda accepts a department-scoped, anonymous agenda", async () => {
  const fake = createFakeSupabaseClient({ agendas: [] });
  const agenda = await createAgenda(asClient(fake), {
    title: "Elect new department lead",
    votingDeadline: DEADLINE,
    createdBy: "user-secretary",
    eligibleVoterScope: "department",
    eligibleDepartmentId: "dept-1",
    isAnonymous: true,
  });
  assert.equal(agenda.eligibleVoterScope, "department");
  assert.equal(agenda.eligibleDepartmentId, "dept-1");
  assert.equal(agenda.isAnonymous, true);
});

test("createAgenda refuses a blank title", async () => {
  const fake = createFakeSupabaseClient({ agendas: [] });
  await assert.rejects(() => createAgenda(asClient(fake), { title: "  ", votingDeadline: DEADLINE, createdBy: "user-secretary" }), ServiceError);
});

test("createAgenda refuses a missing voting deadline", async () => {
  const fake = createFakeSupabaseClient({ agendas: [] });
  await assert.rejects(
    () => createAgenda(asClient(fake), { title: "Title", votingDeadline: "", createdBy: "user-secretary" }),
    ServiceError
  );
});

test("createAgenda refuses a department scope with no departmentId", async () => {
  const fake = createFakeSupabaseClient({ agendas: [] });
  await assert.rejects(
    () =>
      createAgenda(asClient(fake), {
        title: "Title",
        votingDeadline: DEADLINE,
        createdBy: "user-secretary",
        eligibleVoterScope: "department",
      }),
    ServiceError
  );
});

test("createAgenda refuses a specific_users scope with no user IDs", async () => {
  const fake = createFakeSupabaseClient({ agendas: [] });
  await assert.rejects(
    () =>
      createAgenda(asClient(fake), {
        title: "Title",
        votingDeadline: DEADLINE,
        createdBy: "user-secretary",
        eligibleVoterScope: "specific_users",
      }),
    ServiceError
  );
});

test("createAgenda deduplicates specific_users IDs", async () => {
  const fake = createFakeSupabaseClient({ agendas: [] });
  const agenda = await createAgenda(asClient(fake), {
    title: "Title",
    votingDeadline: DEADLINE,
    createdBy: "user-secretary",
    eligibleVoterScope: "specific_users",
    eligibleUserIds: ["user-1", "user-2", "user-1"],
  });
  assert.equal(agenda.eligibleUserIds.length, 2);
});
