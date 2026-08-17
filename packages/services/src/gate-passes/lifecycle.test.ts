import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { checkOutGatePass, markGatePassInTransit, returnGatePassItems } from "./lifecycle";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("checkOutGatePass stamps every item and moves the gate pass to checked_out", async () => {
  const fake = createFakeSupabaseClient({
    gate_passes: [{ id: "gp-1", event_id: "event-1", status: "approved" }],
    gate_pass_items: [
      { id: "item-1", gate_pass_id: "gp-1", asset_id: "asset-1", quantity: 1, checked_out_at: null, returned_at: null },
      { id: "item-2", gate_pass_id: "gp-1", asset_id: "asset-2", quantity: 1, checked_out_at: null, returned_at: null },
    ],
  });
  const gatePass = await checkOutGatePass(asClient(fake), "gp-1");
  assert.equal(gatePass.status, "checked_out");

  const items = fake.__db.get("gate_pass_items") as FakeRow[];
  assert.ok(items.every((i) => i.checked_out_at != null));
});

test("checkOutGatePass refuses a gate pass that isn't approved yet", async () => {
  const fake = createFakeSupabaseClient({
    gate_passes: [{ id: "gp-1", event_id: "event-1", status: "pending_approval" }],
    gate_pass_items: [],
  });
  await assert.rejects(() => checkOutGatePass(asClient(fake), "gp-1"), ServiceError);
});

test("markGatePassInTransit requires checked_out first", async () => {
  const fake = createFakeSupabaseClient({ gate_passes: [{ id: "gp-1", status: "approved" }] });
  await assert.rejects(() => markGatePassInTransit(asClient(fake), "gp-1"), ServiceError);

  const fakeCheckedOut = createFakeSupabaseClient({ gate_passes: [{ id: "gp-1", status: "checked_out" }] });
  const gatePass = await markGatePassInTransit(asClient(fakeCheckedOut), "gp-1");
  assert.equal(gatePass.status, "in_transit");
});

function seedForReturn() {
  return createFakeSupabaseClient({
    gate_passes: [{ id: "gp-1", event_id: "event-1", status: "checked_out" }],
    gate_pass_items: [
      { id: "item-1", gate_pass_id: "gp-1", asset_id: "asset-1", quantity: 1, checked_out_at: "2026-01-01T00:00:00.000Z", returned_at: null },
      { id: "item-2", gate_pass_id: "gp-1", asset_id: "asset-2", quantity: 1, checked_out_at: "2026-01-01T00:00:00.000Z", returned_at: null },
    ],
    asset_assignments: [
      { id: "aa-1", asset_id: "asset-1", target_type: "event", target_id: "event-1", returned_at: null },
      { id: "aa-2", asset_id: "asset-2", target_type: "event", target_id: "event-1", returned_at: null },
    ],
    assets: [
      { id: "asset-1", availability_status: "assigned" },
      { id: "asset-2", availability_status: "assigned" },
    ],
  });
}

test("returnGatePassItems: returning all items as good closes the matching asset_assignments and marks the gate pass returned", async () => {
  const fake = seedForReturn();
  const gatePass = await returnGatePassItems(asClient(fake), "gp-1", [
    { itemId: "item-1", condition: "good" },
    { itemId: "item-2", condition: "good" },
  ]);
  assert.equal(gatePass.status, "returned");

  const assignments = fake.__db.get("asset_assignments") as FakeRow[];
  assert.ok(assignments.every((a) => a.returned_at != null));
  const assets = fake.__db.get("assets") as FakeRow[];
  assert.ok(assets.every((a) => a.availability_status === "available"));
});

test("returnGatePassItems: partial return (only one of two items) leaves the gate pass partially_returned", async () => {
  const fake = seedForReturn();
  const gatePass = await returnGatePassItems(asClient(fake), "gp-1", [{ itemId: "item-1", condition: "good" }]);
  assert.equal(gatePass.status, "partially_returned");
});

test("returnGatePassItems: a lost item dominates the overall status even if others are good", async () => {
  const fake = seedForReturn();
  const gatePass = await returnGatePassItems(asClient(fake), "gp-1", [
    { itemId: "item-1", condition: "good" },
    { itemId: "item-2", condition: "lost" },
  ]);
  assert.equal(gatePass.status, "lost");
});

test("returnGatePassItems: a damaged item dominates over good but not over lost", async () => {
  const fake = seedForReturn();
  const gatePass = await returnGatePassItems(asClient(fake), "gp-1", [
    { itemId: "item-1", condition: "damaged" },
    { itemId: "item-2", condition: "good" },
  ]);
  assert.equal(gatePass.status, "damaged");
});

test("returnGatePassItems refuses to return an already-returned item twice", async () => {
  const fake = seedForReturn();
  await returnGatePassItems(asClient(fake), "gp-1", [{ itemId: "item-1", condition: "good" }]);
  await assert.rejects(() => returnGatePassItems(asClient(fake), "gp-1", [{ itemId: "item-1", condition: "good" }]), ServiceError);
});

test("returnGatePassItems refuses before the gate pass has been checked out", async () => {
  const fake = createFakeSupabaseClient({
    gate_passes: [{ id: "gp-1", event_id: "event-1", status: "approved" }],
    gate_pass_items: [{ id: "item-1", gate_pass_id: "gp-1", asset_id: "asset-1", quantity: 1, returned_at: null }],
    asset_assignments: [],
    assets: [],
  });
  await assert.rejects(() => returnGatePassItems(asClient(fake), "gp-1", [{ itemId: "item-1", condition: "good" }]), ServiceError);
});
