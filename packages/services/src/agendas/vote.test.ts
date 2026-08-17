import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { castVote, getMyVote, listVotesForAgenda } from "./vote";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("castVote records a first-time vote", async () => {
  const fake = createFakeSupabaseClient({ votes: [] });
  const vote = await castVote(asClient(fake), { agendaId: "agenda-1", voterId: "user-1", choice: "yes" });
  assert.equal(vote.agendaId, "agenda-1");
  assert.equal(vote.voterId, "user-1");
  assert.equal(vote.choice, "yes");
});

test("castVote refuses a second vote from the same voter on the same agenda", async () => {
  const fake = createFakeSupabaseClient({
    votes: [{ id: "vote-1", agenda_id: "agenda-1", voter_id: "user-1", choice: "yes", cast_at: "2026-01-01T00:00:00.000Z" }],
  });
  await assert.rejects(() => castVote(asClient(fake), { agendaId: "agenda-1", voterId: "user-1", choice: "no" }), ServiceError);
});

test("castVote allows different voters to vote independently on the same agenda", async () => {
  const fake = createFakeSupabaseClient({
    votes: [{ id: "vote-1", agenda_id: "agenda-1", voter_id: "user-1", choice: "yes", cast_at: "2026-01-01T00:00:00.000Z" }],
  });
  const vote = await castVote(asClient(fake), { agendaId: "agenda-1", voterId: "user-2", choice: "no" });
  assert.equal(vote.voterId, "user-2");
});

test("castVote refuses a missing voter", async () => {
  const fake = createFakeSupabaseClient({ votes: [] });
  await assert.rejects(() => castVote(asClient(fake), { agendaId: "agenda-1", voterId: "", choice: "yes" }), ServiceError);
});

test("getMyVote returns null when the caller hasn't voted yet, and the row once they have", async () => {
  const fake = createFakeSupabaseClient({
    votes: [{ id: "vote-1", agenda_id: "agenda-1", voter_id: "user-1", choice: "abstain", cast_at: "2026-01-01T00:00:00.000Z" }],
  });
  assert.equal(await getMyVote(asClient(fake), "agenda-1", "user-2"), null);
  const mine = await getMyVote(asClient(fake), "agenda-1", "user-1");
  assert.equal(mine?.choice, "abstain");
});

test("listVotesForAgenda returns every row the fake client's own RLS-equivalent select would (this fixture applies no RLS itself — real per-caller scoping is verified live against Postgres, see docs/PHASE_10_4.md)", async () => {
  const fake = createFakeSupabaseClient({
    votes: [
      { id: "vote-1", agenda_id: "agenda-1", voter_id: "user-1", choice: "yes", cast_at: "2026-01-01T00:00:00.000Z" },
      { id: "vote-2", agenda_id: "agenda-1", voter_id: "user-2", choice: "no", cast_at: "2026-01-02T00:00:00.000Z" },
      { id: "vote-3", agenda_id: "agenda-2", voter_id: "user-1", choice: "yes", cast_at: "2026-01-01T00:00:00.000Z" },
    ],
  });
  const rows = await listVotesForAgenda(asClient(fake), "agenda-1");
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => r.voterId),
    ["user-1", "user-2"]
  );
});
