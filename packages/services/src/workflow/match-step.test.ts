import { test } from "node:test";
import assert from "node:assert/strict";
import { isCurrentStepFor } from "./match-step";
import type { WorkflowInstanceSummary } from "./types";

function instance(overrides: Partial<WorkflowInstanceSummary>): WorkflowInstanceSummary {
  return {
    id: "wf-1",
    workflowDefinitionId: "def-1",
    definitionName: "Test",
    recordType: "invitation",
    recordId: "rec-1",
    currentStepOrder: 1,
    currentStepRoleCode: null,
    currentStepUserId: null,
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("isCurrentStepFor matches on required_role_code", () => {
  const wf = instance({ currentStepRoleCode: "secretary" });
  assert.equal(isCurrentStepFor(wf, { id: "user-1", roleCodes: ["secretary"] }), true);
  assert.equal(isCurrentStepFor(wf, { id: "user-1", roleCodes: ["technical_manager"] }), false);
});

test("isCurrentStepFor matches on required_user_id, regardless of role codes — the exact case a prior version of this check silently missed", () => {
  const wf = instance({ currentStepRoleCode: null, currentStepUserId: "user-42" });
  assert.equal(isCurrentStepFor(wf, { id: "user-42", roleCodes: [] }), true);
  assert.equal(isCurrentStepFor(wf, { id: "user-99", roleCodes: ["secretary"] }), false);
});

test("isCurrentStepFor is false when neither the role nor the user matches, and false (not throwing) when a step is misconfigured with neither set", () => {
  const wf = instance({ currentStepRoleCode: null, currentStepUserId: null });
  assert.equal(isCurrentStepFor(wf, { id: "user-1", roleCodes: ["secretary"] }), false);
});
