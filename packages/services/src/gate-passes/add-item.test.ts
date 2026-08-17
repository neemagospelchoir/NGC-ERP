import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { addGatePassItem } from "./add-item";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const GATE_PASS: FakeRow = { id: "gp-1", event_id: "event-1", status: "pending_approval" };
const AVAILABLE_ASSET: FakeRow = { id: "asset-1", availability_status: "available", condition: "good" };

test("addGatePassItem assigns the asset to the gate pass's event and records the line item", async () => {
  const fake = createFakeSupabaseClient({
    gate_passes: [GATE_PASS],
    gate_pass_items: [],
    assets: [AVAILABLE_ASSET],
    asset_assignments: [],
    workflow_instances: [],
  });
  const item = await addGatePassItem(asClient(fake), "gp-1", { assetId: "asset-1", quantity: 2 });
  assert.equal(item.assetId, "asset-1");
  assert.equal(item.quantity, 2);

  const assignments = fake.__db.get("asset_assignments") as FakeRow[];
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0]?.target_type, "event");
  assert.equal(assignments[0]?.target_id, "event-1");

  const assets = fake.__db.get("assets") as FakeRow[];
  assert.equal(assets[0]?.availability_status, "assigned");
});

test("addGatePassItem refuses once the gate pass is no longer pending_approval", async () => {
  const fake = createFakeSupabaseClient({
    gate_passes: [{ ...GATE_PASS, status: "approved" }],
    gate_pass_items: [],
    assets: [AVAILABLE_ASSET],
    asset_assignments: [],
    workflow_instances: [],
  });
  await assert.rejects(() => addGatePassItem(asClient(fake), "gp-1", { assetId: "asset-1" }), ServiceError);
});

test("addGatePassItem refuses once the gate pass has been submitted for approval (a workflow instance already exists)", async () => {
  const fake = createFakeSupabaseClient({
    gate_passes: [GATE_PASS],
    gate_pass_items: [],
    assets: [AVAILABLE_ASSET],
    asset_assignments: [],
    workflow_instances: [{ id: "wf-1", record_type: "gate_pass", record_id: "gp-1", workflow_definition_id: "def-1", current_step_order: 1, status: "pending" }],
    workflow_definitions: [{ id: "def-1", name: "Standard Gate Pass Approval" }],
    workflow_definition_steps: [{ workflow_definition_id: "def-1", step_order: 1, required_role_code: "technical_manager" }],
  });
  await assert.rejects(() => addGatePassItem(asClient(fake), "gp-1", { assetId: "asset-1" }), ServiceError);
});

test("addGatePassItem propagates inventory.assignAsset's own availability check (no bypass)", async () => {
  const fake = createFakeSupabaseClient({
    gate_passes: [GATE_PASS],
    gate_pass_items: [],
    assets: [{ id: "asset-1", availability_status: "under_maintenance", condition: "good" }],
    asset_assignments: [],
    workflow_instances: [],
  });
  await assert.rejects(() => addGatePassItem(asClient(fake), "gp-1", { assetId: "asset-1" }), ServiceError);
});
