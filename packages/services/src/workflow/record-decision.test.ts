import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { recordWorkflowDecision } from "./record-decision";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient(
    {
      workflow_definition_steps: [
        { id: "step-1", workflow_definition_id: "def-1", step_order: 1, required_role_code: "secretary", required_user_id: null, is_mandatory: true },
        { id: "step-2", workflow_definition_id: "def-1", step_order: 2, required_role_code: "technical_manager", required_user_id: null, is_mandatory: true },
      ],
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
    },
    {
      rpcStubs: {
        record_workflow_decision: async () => ({
          data: [{ id: "wf-1", status: "pending", current_step_order: 2, record_type: "invitation", record_id: "inv-1" }],
          error: null,
        }),
      },
    }
  );
}

test("recordWorkflowDecision refuses a caller who doesn't hold the current step's role, before ever calling the RPC", async () => {
  const fake = seed();
  await assert.rejects(
    () =>
      recordWorkflowDecision(asClient(fake), {
        workflowInstanceId: "wf-1",
        decision: "approve",
        actingUserId: "user-x",
        actingUserRoleCodes: ["technical_manager"], // step 1 needs secretary, not technical_manager
      }),
    /not the required approver/
  );
});

test("recordWorkflowDecision succeeds and returns the advanced instance for a matching approver", async () => {
  const fake = seed();
  const result = await recordWorkflowDecision(asClient(fake), {
    workflowInstanceId: "wf-1",
    decision: "approve",
    actingUserId: "user-secretary",
    actingUserRoleCodes: ["secretary"],
  });
  assert.equal(result.currentStepOrder, 2);
  assert.equal(result.status, "pending");
});

test("recordWorkflowDecision matches on required_user_id even without a matching role code", async () => {
  const fake = createFakeSupabaseClient(
    {
      workflow_definition_steps: [
        { id: "step-1", workflow_definition_id: "def-1", step_order: 1, required_role_code: null, required_user_id: "user-specific", is_mandatory: true },
      ],
      workflow_instances: [
        {
          id: "wf-2",
          workflow_definition_id: "def-1",
          record_type: "gate_pass",
          record_id: "gp-1",
          current_step_order: 1,
          status: "pending",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    {
      rpcStubs: {
        record_workflow_decision: async () => ({
          data: [{ id: "wf-2", status: "approved", current_step_order: 1, record_type: "gate_pass", record_id: "gp-1" }],
          error: null,
        }),
      },
    }
  );
  const result = await recordWorkflowDecision(asClient(fake), {
    workflowInstanceId: "wf-2",
    decision: "approve",
    actingUserId: "user-specific",
    actingUserRoleCodes: [],
  });
  assert.equal(result.status, "approved");
});

test("recordWorkflowDecision requires a comment when requesting changes", async () => {
  const fake = seed();
  await assert.rejects(
    () =>
      recordWorkflowDecision(asClient(fake), {
        workflowInstanceId: "wf-1",
        decision: "request_changes",
        actingUserId: "user-secretary",
        actingUserRoleCodes: ["secretary"],
      }),
    /A comment is required/
  );
});

test("recordWorkflowDecision refuses to decide an instance that is no longer pending", async () => {
  const fake = seed();
  fake.__db.set(
    "workflow_instances",
    (fake.__db.get("workflow_instances") ?? []).map((r) => ({ ...r, status: "approved" }))
  );
  await assert.rejects(
    () =>
      recordWorkflowDecision(asClient(fake), {
        workflowInstanceId: "wf-1",
        decision: "approve",
        actingUserId: "user-secretary",
        actingUserRoleCodes: ["secretary"],
      }),
    /no longer awaiting/
  );
});
