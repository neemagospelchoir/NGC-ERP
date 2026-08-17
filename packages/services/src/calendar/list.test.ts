import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listCalendarItems } from "./list";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient({
    departments: [{ id: "dept-1", name: "Sopranos" }],
    events: [
      {
        id: "event-1",
        invitation_id: null,
        name: "City Crusade",
        event_category: "community_outreach",
        event_date: "2026-03-10",
        start_time: null,
        end_time: null,
        venue: "City Hall",
        location: null,
        status: "confirmed",
        qr_token: "qr-1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        // outside the requested window — must not appear
        id: "event-2",
        invitation_id: null,
        name: "Next Quarter Concert",
        event_category: "internal_performance",
        event_date: "2026-06-01",
        start_time: null,
        end_time: null,
        venue: null,
        location: null,
        status: "scheduled",
        qr_token: "qr-2",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    attendance_sessions: [
      {
        id: "session-1",
        session_type: "rehearsal",
        title: "Weekly rehearsal",
        department_id: null,
        event_id: null,
        session_date: "2026-03-05",
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
        session_date: "2026-03-05",
        starts_at: null,
        ends_at: null,
        created_by: "user-hr",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    contribution_campaigns: [
      {
        id: "campaign-1",
        name: "Building Fund",
        description: null,
        target_amount: 1000,
        currency: "TZS",
        deadline: "2026-03-20",
        status: "active",
        created_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        // closed — must not appear even though the deadline is in-window
        id: "campaign-2",
        name: "Old Drive",
        description: null,
        target_amount: 500,
        currency: "TZS",
        deadline: "2026-03-15",
        status: "closed",
        created_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        // no deadline — never placeable on a calendar
        id: "campaign-3",
        name: "Undated Drive",
        description: null,
        target_amount: null,
        currency: "TZS",
        deadline: null,
        status: "active",
        created_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
}

test("listCalendarItems merges events, attendance sessions, and active campaign deadlines within the range, sorted by date", async () => {
  const fake = seed();
  const items = await listCalendarItems(asClient(fake), { from: "2026-03-01", to: "2026-03-31" });

  // session-1 ("Weekly rehearsal") and session-2 ("Sopranos meeting") share
  // 2026-03-05 — the tiebreak is an alphabetical title sort, which orders
  // "Sopranos meeting" before "Weekly rehearsal".
  assert.deepEqual(
    items.map((i) => i.id),
    ["attendance_session:session-2", "attendance_session:session-1", "event:event-1", "contribution_deadline:campaign-1"]
  );
  assert.ok(items.every((i) => i.date >= "2026-03-01" && i.date <= "2026-03-31"));
});

test("listCalendarItems excludes items outside the requested range", async () => {
  const fake = seed();
  const items = await listCalendarItems(asClient(fake), { from: "2026-03-01", to: "2026-03-31" });
  assert.equal(items.some((i) => i.id === "event:event-2"), false);
});

test("listCalendarItems excludes non-active campaigns and campaigns with no deadline", async () => {
  const fake = seed();
  const items = await listCalendarItems(asClient(fake), { from: "2026-01-01", to: "2026-12-31" });
  assert.equal(items.some((i) => i.id === "contribution_deadline:campaign-2"), false);
  assert.equal(items.some((i) => i.id === "contribution_deadline:campaign-3"), false);
  assert.ok(items.some((i) => i.id === "contribution_deadline:campaign-1"));
});

test("listCalendarItems honors the types filter", async () => {
  const fake = seed();
  const items = await listCalendarItems(asClient(fake), { from: "2026-03-01", to: "2026-03-31", types: ["event"] });
  assert.deepEqual(
    items.map((i) => i.type),
    ["event"]
  );
});

test("listCalendarItems includes a department name in an attendance session's subtitle, and 'Whole choir' for a null department", async () => {
  const fake = seed();
  const items = await listCalendarItems(asClient(fake), { from: "2026-03-01", to: "2026-03-31", types: ["attendance_session"] });
  const wholeChoir = items.find((i) => i.id === "attendance_session:session-1");
  const deptScoped = items.find((i) => i.id === "attendance_session:session-2");
  assert.ok(wholeChoir?.subtitle.includes("Whole choir"));
  assert.ok(deptScoped?.subtitle.includes("Sopranos"));
});
