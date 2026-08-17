import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { syncOfflineAttendance } from "./sync-offline";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed(extra: Record<string, unknown[]> = {}) {
  return createFakeSupabaseClient({
    attendance_sessions: [{ id: "session-1", session_type: "rehearsal", title: "Rehearsal", department_id: null, event_id: null, session_date: "2026-03-01", starts_at: null, ends_at: null, created_by: "user-hr", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }],
    attendance: [],
    lookup_values: [
      { id: "lv-1", category: "attendance_status", code: "present", label: "Present", sort_order: 1, is_active: true, metadata: { counts_as_present: true } },
      { id: "lv-2", category: "attendance_status", code: "absent", label: "Absent", sort_order: 2, is_active: true, metadata: {} },
    ],
    ...extra,
  });
}

test("syncOfflineAttendance inserts a new record and returns 'synced'", async () => {
  const fake = seed();
  const result = await syncOfflineAttendance(asClient(fake), {
    sessionId: "session-1",
    memberId: "member-1",
    statusCode: "present",
    recordedBy: "user-leader",
    clientIdempotencyKey: "key-1",
  });
  assert.equal(result.outcome, "synced");
  const rows = fake.__db.get("attendance") ?? [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.recorded_via, "mobile");
  assert.equal(rows[0]?.client_idempotency_key, "key-1");
});

test("re-syncing the exact same offline record (same idempotency key) is a no-op, not a duplicate or an error", async () => {
  const fake = seed();
  const first = await syncOfflineAttendance(asClient(fake), {
    sessionId: "session-1",
    memberId: "member-1",
    statusCode: "present",
    recordedBy: "user-leader",
    clientIdempotencyKey: "key-1",
  });
  assert.equal(first.outcome, "synced");

  const second = await syncOfflineAttendance(asClient(fake), {
    sessionId: "session-1",
    memberId: "member-1",
    statusCode: "present",
    recordedBy: "user-leader",
    clientIdempotencyKey: "key-1",
  });
  assert.equal(second.outcome, "already_synced");
  if (first.outcome === "synced" && second.outcome === "already_synced") {
    assert.equal(second.recordId, first.recordId);
  }

  const rows = fake.__db.get("attendance") ?? [];
  assert.equal(rows.length, 1, "must not duplicate the row");
});

test("a genuinely different write for the same session+member surfaces as a conflict, and does not overwrite it", async () => {
  const fake = seed({
    attendance: [
      {
        id: "att-1",
        session_id: "session-1",
        member_id: "member-1",
        status_code: "absent",
        recorded_via: "manual",
        recorded_by: "user-hr",
        client_idempotency_key: null,
        notes: null,
        created_at: "2026-03-01T09:00:00.000Z",
        updated_at: "2026-03-01T09:00:00.000Z",
      },
    ],
  });

  const result = await syncOfflineAttendance(asClient(fake), {
    sessionId: "session-1",
    memberId: "member-1",
    statusCode: "present",
    recordedBy: "user-leader",
    clientIdempotencyKey: "key-offline-1",
  });

  assert.equal(result.outcome, "conflict");
  if (result.outcome === "conflict") {
    assert.equal(result.existing.statusCode, "absent");
    assert.equal(result.existing.recordedVia, "manual");
  }

  // The pre-existing row must be untouched — still "absent", not overwritten with "present".
  const rows = fake.__db.get("attendance") ?? [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status_code, "absent");
});

test("a vanished (hard-deleted) session reports 'session_not_found' rather than writing into nothing", async () => {
  const fake = seed();
  const result = await syncOfflineAttendance(asClient(fake), {
    sessionId: "session-does-not-exist",
    memberId: "member-1",
    statusCode: "present",
    recordedBy: "user-leader",
    clientIdempotencyKey: "key-1",
  });
  assert.equal(result.outcome, "session_not_found");
  assert.equal((fake.__db.get("attendance") ?? []).length, 0);
});

test("rejects a blank client idempotency key — this path is for offline sync only", async () => {
  const fake = seed();
  await assert.rejects(
    () =>
      syncOfflineAttendance(asClient(fake), {
        sessionId: "session-1",
        memberId: "member-1",
        statusCode: "present",
        recordedBy: "user-leader",
        clientIdempotencyKey: "   ",
      }),
    /idempotency key/
  );
});

test("rejects an unrecognized status code before touching the session or attendance tables", async () => {
  const fake = seed();
  await assert.rejects(() =>
    syncOfflineAttendance(asClient(fake), {
      sessionId: "session-1",
      memberId: "member-1",
      statusCode: "on_the_moon",
      recordedBy: "user-leader",
      clientIdempotencyKey: "key-1",
    })
  );
  assert.equal((fake.__db.get("attendance") ?? []).length, 0);
});
