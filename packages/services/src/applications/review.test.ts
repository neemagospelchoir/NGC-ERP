import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { advanceApplicationStatus, decideApplication, markApplicationIncomplete } from "./review";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function seedApplication(status: string, overrides: Partial<FakeRow> = {}) {
  return createFakeSupabaseClient({
    applications: [
      {
        id: "app-1",
        application_number: "APP-2026-0001",
        application_type: "new_member",
        access_token_hash: "hash",
        verification_contact: "a@example.com",
        submitted_data: { personal: {}, church: {}, education: {}, professional: {}, choirHistory: {}, musical: {} },
        status,
        completion_percentage: 100,
        missing_fields: [],
        reviewed_by: null,
        reviewed_at: null,
        decision_reason: null,
        submitted_at: "2026-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
      },
    ],
  });
}

test("advanceApplicationStatus moves submitted -> pending_review", async () => {
  const fake = seedApplication("submitted");
  const result = await advanceApplicationStatus(asClient(fake), "app-1", "pending_review");
  assert.equal(result.status, "pending_review");
});

test("advanceApplicationStatus rejects an out-of-order jump (submitted -> under_verification)", async () => {
  const fake = seedApplication("submitted");
  await assert.rejects(() => advanceApplicationStatus(asClient(fake), "app-1", "under_verification"), ServiceError);
});

test("markApplicationIncomplete requires at least one non-blank note", async () => {
  const fake = seedApplication("submitted");
  await assert.rejects(() => markApplicationIncomplete(asClient(fake), "app-1", ["   ", ""]), ServiceError);
});

test("markApplicationIncomplete sets status and stores the notes as missing_fields", async () => {
  const fake = seedApplication("under_verification");
  const result = await markApplicationIncomplete(asClient(fake), "app-1", ["Passport photo is blurry"]);
  assert.equal(result.status, "incomplete");
  assert.deepEqual(result.missingFields, ["Passport photo is blurry"]);
});

test("decideApplication requires a non-blank reason", async () => {
  const fake = seedApplication("pending_approval");
  await assert.rejects(
    () => decideApplication(asClient(fake), "app-1", { reviewerId: "user-hr", decision: "approved", reason: "  " }),
    ServiceError
  );
});

test("decideApplication rejects deciding an application that isn't pending_approval", async () => {
  const fake = seedApplication("submitted");
  await assert.rejects(
    () => decideApplication(asClient(fake), "app-1", { reviewerId: "user-hr", decision: "approved", reason: "Looks good" }),
    ServiceError
  );
});

test("decideApplication approves and records reviewer/reason/timestamp", async () => {
  const fake = seedApplication("pending_approval");
  const result = await decideApplication(asClient(fake), "app-1", {
    reviewerId: "user-hr",
    decision: "approved",
    reason: "Meets all onboarding criteria.",
  });
  assert.equal(result.status, "approved");
  assert.equal(result.reviewedBy, "user-hr");
  assert.equal(result.decisionReason, "Meets all onboarding criteria.");
  assert.ok(result.reviewedAt);
});

test("decideApplication can reject with a reason", async () => {
  const fake = seedApplication("pending_approval");
  const result = await decideApplication(asClient(fake), "app-1", {
    reviewerId: "user-hr",
    decision: "rejected",
    reason: "Does not meet minimum age requirement.",
  });
  assert.equal(result.status, "rejected");
});
