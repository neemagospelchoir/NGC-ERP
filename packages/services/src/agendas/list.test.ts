import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getAgenda, getAgendaResults, listAgendas } from "./list";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function agendaRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "agenda-1",
    title: "Approve annual budget",
    description: null,
    voting_method: "yes_no_abstain",
    eligible_voter_scope: "all_members",
    eligible_department_id: null,
    eligible_family_id: null,
    eligible_user_ids: [],
    is_anonymous: false,
    voting_deadline: "2026-12-31T00:00:00.000Z",
    status: "open",
    created_by: "user-secretary",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("listAgendas returns every agenda row, mapped", async () => {
  const fake = createFakeSupabaseClient({ agendas: [agendaRow(), agendaRow({ id: "agenda-2", title: "Elect lead" })] });
  const rows = await listAgendas(asClient(fake));
  assert.equal(rows.length, 2);
  assert.ok(rows.some((r) => r.title === "Elect lead"));
});

test("getAgenda returns null for an unknown id", async () => {
  const fake = createFakeSupabaseClient({ agendas: [agendaRow()] });
  assert.equal(await getAgenda(asClient(fake), "does-not-exist"), null);
});

test("getAgendaResults maps the aggregate view, defaulting missing counts to 0", async () => {
  const fake = createFakeSupabaseClient({
    agenda_results: [{ agenda_id: "agenda-1", yes_count: 3, no_count: 1, abstain_count: 0, total_votes: 4 }],
  });
  const results = await getAgendaResults(asClient(fake), "agenda-1");
  assert.deepEqual(results, { agendaId: "agenda-1", yesCount: 3, noCount: 1, abstainCount: 0, totalVotes: 4 });
});

test("getAgendaResults returns null when the agenda has no votes yet", async () => {
  const fake = createFakeSupabaseClient({ agenda_results: [] });
  assert.equal(await getAgendaResults(asClient(fake), "agenda-1"), null);
});
