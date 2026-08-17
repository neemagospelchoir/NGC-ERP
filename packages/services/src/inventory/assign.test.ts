import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { assignAsset, returnAssignment } from "./assign";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const AVAILABLE_ASSET: FakeRow[] = [{ id: "asset-1", asset_tag: "AST-2026-0001", availability_status: "available", condition: "good" }];

test("assignAsset assigns an available asset and flips its availability_status to assigned", async () => {
  const fake = createFakeSupabaseClient({ assets: AVAILABLE_ASSET, asset_assignments: [] });
  const assignment = await assignAsset(asClient(fake), { assetId: "asset-1", targetType: "event", targetId: "event-1" });
  assert.equal(assignment.status, "assigned");
  assert.equal(assignment.quantity, 1); // default

  const assets = fake.__db.get("assets") as FakeRow[];
  assert.equal(assets[0]?.availability_status, "assigned");
});

test("assignAsset refuses an unavailable asset without an explicit override", async () => {
  const fake = createFakeSupabaseClient({
    assets: [{ id: "asset-1", availability_status: "assigned" }],
    asset_assignments: [],
  });
  await assert.rejects(() => assignAsset(asClient(fake), { assetId: "asset-1", targetType: "member", targetId: "member-1" }), ServiceError);
});

test("assignAsset proceeds over an unavailable asset when override is set", async () => {
  const fake = createFakeSupabaseClient({
    assets: [{ id: "asset-1", availability_status: "under_maintenance" }],
    asset_assignments: [],
  });
  const assignment = await assignAsset(asClient(fake), {
    assetId: "asset-1",
    targetType: "department",
    targetId: "dept-1",
    override: true,
  });
  assert.equal(assignment.targetType, "department");
});

test("assignAsset refuses a disposed asset even with override set — disposal is terminal", async () => {
  const fake = createFakeSupabaseClient({
    assets: [{ id: "asset-1", availability_status: "disposed" }],
    asset_assignments: [],
  });
  await assert.rejects(
    () => assignAsset(asClient(fake), { assetId: "asset-1", targetType: "event", targetId: "event-1", override: true }),
    ServiceError
  );
});

test("assignAsset rejects a missing asset", async () => {
  const fake = createFakeSupabaseClient({ assets: [], asset_assignments: [] });
  await assert.rejects(() => assignAsset(asClient(fake), { assetId: "does-not-exist", targetType: "event", targetId: "event-1" }), ServiceError);
});

test("returnAssignment with condition=good restores the asset to available", async () => {
  const fake = createFakeSupabaseClient({
    assets: [{ id: "asset-1", availability_status: "assigned" }],
    asset_assignments: [{ id: "assign-1", asset_id: "asset-1", returned_at: null, status: "assigned" }],
  });
  const result = await returnAssignment(asClient(fake), { assignmentId: "assign-1", returnCondition: "good" });
  assert.equal(result.status, "returned");

  const assets = fake.__db.get("assets") as FakeRow[];
  assert.equal(assets[0]?.availability_status, "available");
});

test("returnAssignment with condition=damaged requires a damage report and sets availability to under_maintenance", async () => {
  const fake = createFakeSupabaseClient({
    assets: [{ id: "asset-1", availability_status: "assigned" }],
    asset_assignments: [{ id: "assign-1", asset_id: "asset-1", returned_at: null, status: "assigned" }],
  });
  await assert.rejects(() => returnAssignment(asClient(fake), { assignmentId: "assign-1", returnCondition: "damaged" }), ServiceError);

  const result = await returnAssignment(asClient(fake), {
    assignmentId: "assign-1",
    returnCondition: "damaged",
    damageReport: "Cracked casing",
  });
  assert.equal(result.status, "damaged");
  const assets = fake.__db.get("assets") as FakeRow[];
  assert.equal(assets[0]?.availability_status, "under_maintenance");
});

test("returnAssignment refuses to return an assignment twice", async () => {
  const fake = createFakeSupabaseClient({
    assets: [{ id: "asset-1", availability_status: "available" }],
    asset_assignments: [{ id: "assign-1", asset_id: "asset-1", returned_at: "2026-01-01T00:00:00.000Z", status: "returned" }],
  });
  await assert.rejects(() => returnAssignment(asClient(fake), { assignmentId: "assign-1", returnCondition: "good" }), ServiceError);
});
