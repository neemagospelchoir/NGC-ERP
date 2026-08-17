import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createSession, getSession, listSessions } from "./sessions";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient({
    departments: [{ id: "dept-1", name: "Sopranos" }],
    attendance_sessions: [
      {
        id: "session-1",
        session_type: "rehearsal",
        title: "Weekly rehearsal",
        department_id: null,
        event_id: null,
        session_date: "2026-01-05",
        starts_at: null,
        ends_at: null,
        created_by: "user-hr",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "session-2",
        session_type: "department_meeting",
        title: "Sopranos meeting",
        department_id: "dept-1",
        event_id: null,
        session_date: "2026-01-10",
        starts_at: null,
        ends_at: null,
        created_by: "user-hr",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
}

test("createSession inserts a session and resolves its department name", async () => {
  const fake = seed();
  const result = await createSession(asClient(fake), {
    sessionType: "rehearsal",
    title: "  Special rehearsal  ",
    departmentId: "dept-1",
    sessionDate: "2026-02-01",
    createdBy: "user-hr",
  });
  assert.equal(result.title, "Special rehearsal");
  assert.equal(result.departmentName, "Sopranos");
});

test("createSession rejects a blank title", async () => {
  const fake = seed();
  await assert.rejects(() =>
    createSession(asClient(fake), {
      sessionType: "rehearsal",
      title: "   ",
      sessionDate: "2026-02-01",
      createdBy: "user-hr",
    })
  );
});

test("listSessions resolves department names and filters by department", async () => {
  const fake = seed();
  const all = await listSessions(asClient(fake));
  assert.equal(all.length, 2);
  const scoped = await listSessions(asClient(fake), { departmentId: "dept-1" });
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0]?.departmentName, "Sopranos");
});

test("listSessions filters by date range", async () => {
  const fake = seed();
  const rows = await listSessions(asClient(fake), { from: "2026-01-06", to: "2026-01-31" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, "session-2");
});

test("getSession returns null for an unknown id", async () => {
  const fake = seed();
  const row = await getSession(asClient(fake), "missing");
  assert.equal(row, null);
});
