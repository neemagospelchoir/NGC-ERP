import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listReportDefinitions, runReport } from "./registry";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("listReportDefinitions exposes all fourteen PRD §11 reports, in a stable order", () => {
  assert.deepEqual(listReportDefinitions(), [
    { key: "members", title: "Member Report" },
    { key: "attendance", title: "Attendance Report" },
    { key: "invitations", title: "Invitation Report" },
    { key: "contributions", title: "Contribution Report" },
    { key: "expenses", title: "Expense Report" },
    { key: "vendors", title: "Vendor Report" },
    { key: "assets", title: "Asset Report" },
    { key: "events", title: "Event Report" },
    { key: "logistics", title: "Logistics Report" },
    { key: "technical", title: "Technical Report" },
    { key: "uniforms", title: "Uniform Report" },
    { key: "discipline", title: "Discipline Report" },
    { key: "hr", title: "HR Report" },
    { key: "management", title: "Management Report" },
  ]);
});

test("runReport dispatches to the matching definition", async () => {
  const fake = createFakeSupabaseClient({ members: [], departments: [], families: [] });
  const result = await runReport(asClient(fake), "members", { period: { period: "yearly", year: 2026 } });
  assert.equal(result.reportKey, "members");
});

test("runReport rejects an unknown report key rather than silently returning nothing", async () => {
  const fake = createFakeSupabaseClient({});
  await assert.rejects(() => runReport(asClient(fake), "not-a-real-report" as never, { period: { period: "yearly", year: 2026 } }));
});
