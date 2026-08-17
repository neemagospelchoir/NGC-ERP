import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { startWorkflow } from "./start";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seed() {
  return createFakeSupabaseClient(
    {
      workflow_definitions: [
        { id: "def-invitation", record_type: "invitation", name: "Standard Invitation Approval", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
      ],
      workflow_definition_steps: [
        { id: "step-1", workflow_definition_id: "def-invitation", step_order: 1, required_role_code: "secretary", required_user_id: null, is_mandatory: true },
        { id: "step-2", workflow_definition_id: "def-invitation", step_order: 2, required_role_code: "technical_manager", required_user_id: null, is_mandatory: true },
      ],
      workflow_instances: [],
    }
  );
}

test("startWorkflow creates a pending instance at step 1 with the first step's role", async () => {
  const fake = seed();
  const instance = await startWorkflow(asClient(fake), { recordType: "invitation", recordId: "inv-1" });
  assert.equal(instance.status, "pending");
  assert.equal(instance.currentStepOrder, 1);
  assert.equal(instance.currentStepRoleCode, "secretary");
  assert.equal(instance.definitionName, "Standard Invitation Approval");
});

test("startWorkflow throws a clear error when no active definition exists for the record type", async () => {
  const fake = createFakeSupabaseClient({ workflow_definitions: [], workflow_definition_steps: [], workflow_instances: [] });
  await assert.rejects(
    () => startWorkflow(asClient(fake), { recordType: "gate_pass", recordId: "gp-1" }),
    /No active approval workflow/
  );
});

test("startWorkflow refuses to start a second instance for the same record (unique record_type+record_id)", async () => {
  const fake = seed();
  await startWorkflow(asClient(fake), { recordType: "invitation", recordId: "inv-1" });
  await assert.rejects(() => startWorkflow(asClient(fake), { recordType: "invitation", recordId: "inv-1" }), /already been started/);
});
