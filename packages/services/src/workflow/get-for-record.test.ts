import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getWorkflowForRecord, listWorkflowDecisions } from "./get-for-record";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("getWorkflowForRecord returns null when no workflow has been started for the record", async () => {
  const fake = createFakeSupabaseClient({ workflow_instances: [] });
  const result = await getWorkflowForRecord(asClient(fake), "invitation", "inv-1");
  assert.equal(result, null);
});

test("getWorkflowForRecord resolves the definition name and current step's role", async () => {
  const fake = createFakeSupabaseClient({
    workflow_definitions: [{ id: "def-1", name: "Standard Invitation Approval" }],
    workflow_definition_steps: [{ id: "s1", workflow_definition_id: "def-1", step_order: 1, required_role_code: "secretary" }],
    workflow_instances: [
      {
        id: "wf-1",
        workflow_definition_id: "def-1",
        record_type: "invitation",
        record_id: "inv-1",
        current_step_order: 1,
        status: "pending",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
  const result = await getWorkflowForRecord(asClient(fake), "invitation", "inv-1");
  assert.equal(result?.definitionName, "Standard Invitation Approval");
  assert.equal(result?.currentStepRoleCode, "secretary");
});

test("listWorkflowDecisions returns decisions in chronological order", async () => {
  const fake = createFakeSupabaseClient({
    workflow_step_decisions: [
      { id: "d2", workflow_instance_id: "wf-1", step_order: 1, approver_id: "u1", approver_role_code: "secretary", decision: "approve", comment: null, decided_at: "2026-01-02T00:00:00.000Z" },
      { id: "d1", workflow_instance_id: "wf-1", step_order: 1, approver_id: "u1", approver_role_code: "secretary", decision: "request_changes", comment: "Fix venue.", decided_at: "2026-01-01T00:00:00.000Z" },
    ],
  });
  const rows = await listWorkflowDecisions(asClient(fake), "wf-1");
  assert.deepEqual(rows.map((r) => r.id), ["d1", "d2"]);
});
