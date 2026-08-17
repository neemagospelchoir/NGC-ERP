import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runManagementReport } from "./management";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const DEFINITIONS: FakeRow[] = [{ id: "def-1", name: "Standard Invitation Approval", record_type: "invitation", is_active: true }];
const STEPS: FakeRow[] = [
  { id: "s1", workflow_definition_id: "def-1", step_order: 1, required_role_code: "secretary", required_user_id: null },
  { id: "s2", workflow_definition_id: "def-1", step_order: 2, required_role_code: "technical_manager", required_user_id: null },
];
const INSTANCES: FakeRow[] = [
  {
    id: "wf-1",
    workflow_definition_id: "def-1",
    record_type: "invitation",
    record_id: "inv-1",
    current_step_order: 2,
    status: "pending",
    created_at: "2026-02-05T00:00:00.000Z",
    updated_at: "2026-02-05T00:00:00.000Z",
  },
  {
    id: "wf-2",
    workflow_definition_id: "def-1",
    record_type: "invitation",
    record_id: "inv-2",
    current_step_order: 1,
    status: "rejected",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
  },
];

/**
 * These unit tests call `runManagementReport` directly with a fake client
 * that has no RLS at all — same query-shape-only caveat as every other
 * definition's test file. The real confidentiality/visibility boundary is
 * `workflow_instances_select_scoped` (0019), verified against a real
 * database elsewhere (see workflow/list-pending.ts's own doc comment).
 */
test("runManagementReport scopes by created_at within the resolved period and resolves the workflow name", async () => {
  const fake = createFakeSupabaseClient({
    workflow_definitions: DEFINITIONS,
    workflow_definition_steps: STEPS,
    workflow_instances: INSTANCES,
  });
  const result = await runManagementReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.definitionName, "Standard Invitation Approval");
  assert.equal(result.rows[0]?.recordType, "invitation");
});

test("runManagementReport narrows by status across every status, not just pending", async () => {
  const fake = createFakeSupabaseClient({
    workflow_definitions: DEFINITIONS,
    workflow_definition_steps: STEPS,
    workflow_instances: INSTANCES,
  });
  const result = await runManagementReport(asClient(fake), {
    period: { period: "yearly", year: 2026 },
    status: "rejected",
  });
  assert.deepEqual(result.rows.map((r) => r.status), ["rejected"]);
});
