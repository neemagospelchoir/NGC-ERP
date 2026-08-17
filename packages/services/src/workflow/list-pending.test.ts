import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listMyPendingApprovals, listWorkflowInstances } from "./list-pending";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("listMyPendingApprovals returns only pending instances, with definition name and current step role resolved", async () => {
  const fake = createFakeSupabaseClient({
    workflow_definitions: [{ id: "def-1", name: "Standard Invitation Approval", record_type: "invitation", is_active: true }],
    workflow_definition_steps: [
      { id: "s1", workflow_definition_id: "def-1", step_order: 1, required_role_code: "secretary", required_user_id: null },
      { id: "s2", workflow_definition_id: "def-1", step_order: 2, required_role_code: "technical_manager", required_user_id: null },
    ],
    workflow_instances: [
      {
        id: "wf-1",
        workflow_definition_id: "def-1",
        record_type: "invitation",
        record_id: "inv-1",
        current_step_order: 2,
        status: "pending",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "wf-2",
        workflow_definition_id: "def-1",
        record_type: "invitation",
        record_id: "inv-2",
        current_step_order: 1,
        status: "approved",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  const rows = await listMyPendingApprovals(asClient(fake));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.recordId, "inv-1");
  assert.equal(rows[0]?.currentStepRoleCode, "technical_manager");
  assert.equal(rows[0]?.definitionName, "Standard Invitation Approval");
});

test("listMyPendingApprovals returns an empty list when there are no pending instances", async () => {
  const fake = createFakeSupabaseClient({ workflow_instances: [] });
  const rows = await listMyPendingApprovals(asClient(fake));
  assert.deepEqual(rows, []);
});

test("listWorkflowInstances returns instances of every status within a period, not just pending — added for Phase 13.2's Management Report", async () => {
  const fake = createFakeSupabaseClient({
    workflow_definitions: [{ id: "def-1", name: "Standard Invitation Approval", record_type: "invitation", is_active: true }],
    workflow_definition_steps: [
      { id: "s1", workflow_definition_id: "def-1", step_order: 1, required_role_code: "secretary", required_user_id: null },
      { id: "s2", workflow_definition_id: "def-1", step_order: 2, required_role_code: "technical_manager", required_user_id: null },
    ],
    workflow_instances: [
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
        status: "approved",
        created_at: "2026-02-10T00:00:00.000Z",
        updated_at: "2026-02-10T00:00:00.000Z",
      },
      {
        id: "wf-3",
        workflow_definition_id: "def-1",
        record_type: "invitation",
        record_id: "inv-3",
        current_step_order: 1,
        status: "rejected",
        created_at: "2026-05-01T00:00:00.000Z", // outside the period
        updated_at: "2026-05-01T00:00:00.000Z",
      },
    ],
  });

  const rows = await listWorkflowInstances(asClient(fake), { createdFrom: "2026-02-01", createdTo: "2026-02-28" });
  assert.deepEqual(
    rows.map((r) => r.recordId).sort(),
    ["inv-1", "inv-2"]
  );

  const approvedOnly = await listWorkflowInstances(asClient(fake), { status: "approved" });
  assert.deepEqual(approvedOnly.map((r) => r.recordId), ["inv-2"]);
});
