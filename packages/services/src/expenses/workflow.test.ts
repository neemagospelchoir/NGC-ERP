import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { decideExpenseRequestApproval, submitExpenseRequestForApproval } from "./workflow";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

/**
 * Mirrors the real `start_expense_request_workflow` (0031) SQL logic
 * closely enough for these tests — same approach as gate-passes/
 * workflow.test.ts's `makeStartRpcStub`. Unlike the real RPC, this does NOT
 * re-check `requested_by = auth.uid()` — that authorization check is
 * exercised against real Postgres (docs/PHASE_9_2.md §4/§6), the same
 * division of labor already established for every other RPC mock/stub in
 * this codebase (the mock/stub exercises the mechanical state transition;
 * the real migration's SQL is what actually enforces the permission
 * check).
 */
function makeStartRpcStub(fake: ReturnType<typeof createFakeSupabaseClient>) {
  return async (args: Record<string, unknown>) => {
    const requests = fake.__db.get("expense_requests") ?? [];
    const request = requests.find((r) => r.id === args.p_expense_request_id);
    if (!request) return { data: null, error: { message: "Expense request not found" } };
    if (request.status !== "draft") return { data: null, error: { message: "This expense request is no longer a draft" } };

    const existing = (fake.__db.get("workflow_instances") ?? []).find(
      (i) => i.record_type === "expense_request" && i.record_id === args.p_expense_request_id
    );
    if (existing) return { data: null, error: { message: "An approval workflow has already been started for this expense request" } };

    const definition = (fake.__db.get("workflow_definitions") ?? []).find((d) => d.record_type === "expense_request" && d.is_active);
    if (!definition) return { data: null, error: { message: "No active approval workflow is configured for expense requests" } };

    request.status = "pending_approval";

    const instances = fake.__db.get("workflow_instances") ?? [];
    const instance = {
      id: `wf-${instances.length}`,
      workflow_definition_id: definition.id,
      record_type: "expense_request",
      record_id: args.p_expense_request_id,
      current_step_order: 1,
      status: "pending",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    instances.push(instance);
    fake.__db.set("workflow_instances", instances);
    return { data: [instance], error: null };
  };
}

/** Mirrors the real `record_workflow_decision` (0028) SQL logic — same pattern as gate-passes/workflow.test.ts. */
function makeDecisionRpcStub(fake: ReturnType<typeof createFakeSupabaseClient>) {
  return async (args: Record<string, unknown>) => {
    const instances = fake.__db.get("workflow_instances") ?? [];
    const instance = instances.find((i) => i.id === args.p_workflow_instance_id);
    if (!instance) return { data: null, error: { message: "not found" } };

    const steps = fake.__db.get("workflow_definition_steps") ?? [];
    const currentStep = steps.find(
      (s) => s.workflow_definition_id === instance.workflow_definition_id && s.step_order === instance.current_step_order
    );

    const decisions = fake.__db.get("workflow_step_decisions") ?? [];
    decisions.push({
      id: `dec-${decisions.length}`,
      workflow_instance_id: instance.id,
      step_order: instance.current_step_order,
      approver_id: "test-approver",
      approver_role_code: currentStep?.required_role_code ?? null,
      decision: args.p_decision,
      comment: args.p_comment ?? null,
      decided_at: "2026-01-01T00:00:00.000Z",
    });
    fake.__db.set("workflow_step_decisions", decisions);

    if (args.p_decision === "reject") {
      instance.status = "rejected";
    } else if (args.p_decision === "approve") {
      const maxStep = Math.max(
        ...steps.filter((s) => s.workflow_definition_id === instance.workflow_definition_id).map((s) => Number(s.step_order))
      );
      if (Number(instance.current_step_order) >= maxStep) {
        instance.status = "approved";
      } else {
        instance.current_step_order = Number(instance.current_step_order) + 1;
      }
    }

    return {
      data: [
        { id: instance.id, status: instance.status, current_step_order: instance.current_step_order, record_type: instance.record_type, record_id: instance.record_id },
      ],
      error: null,
    };
  };
}

function seed(status = "draft") {
  const fake = createFakeSupabaseClient({
    expense_requests: [
      {
        id: "expense-1",
        request_number: "EXP-2026-0001",
        requested_by: "user-requester",
        description: "Transport",
        amount: 50000,
        currency: "TZS",
        category: null,
        department_id: null,
        event_id: null,
        supporting_document_id: null,
        status,
        paid_at: null,
        payment_reference: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ] as FakeRow[],
    workflow_definitions: [
      { id: "def-expense", record_type: "expense_request", name: "Standard Expense Approval", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
    ] as FakeRow[],
    workflow_definition_steps: [
      { id: "s1", workflow_definition_id: "def-expense", step_order: 1, required_role_code: "finance_manager", required_user_id: null },
      { id: "s2", workflow_definition_id: "def-expense", step_order: 2, required_role_code: "secretary", required_user_id: null },
      { id: "s3", workflow_definition_id: "def-expense", step_order: 3, required_role_code: "chairman", required_user_id: null },
    ] as FakeRow[],
    workflow_instances: [] as FakeRow[],
    workflow_step_decisions: [] as FakeRow[],
  });
  const startStub = makeStartRpcStub(fake);
  const decisionStub = makeDecisionRpcStub(fake);
  return {
    ...fake,
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      if (fn === "start_expense_request_workflow") return startStub(args);
      if (fn === "record_workflow_decision") return decisionStub(args);
      return { data: null, error: { message: `unstubbed rpc "${fn}"` } };
    },
  } as unknown as ReturnType<typeof createFakeSupabaseClient>;
}

test("submitExpenseRequestForApproval starts the workflow and flips the request to pending_approval", async () => {
  const fake = seed();
  await submitExpenseRequestForApproval(asClient(fake), "expense-1");
  assert.equal((fake.__db.get("workflow_instances") ?? []).length, 1);
  const request = (fake.__db.get("expense_requests") ?? []).find((r) => r.id === "expense-1");
  assert.equal(request?.status, "pending_approval");
});

test("submitExpenseRequestForApproval refuses a request that is no longer a draft", async () => {
  const fake = seed("pending_approval");
  await assert.rejects(() => submitExpenseRequestForApproval(asClient(fake), "expense-1"), ServiceError);
});

test("submitExpenseRequestForApproval refuses to start a second workflow for the same request", async () => {
  const fake = seed();
  await submitExpenseRequestForApproval(asClient(fake), "expense-1");
  // The request is now pending_approval, not draft, so a second call is
  // refused by the draft-only guard before it would even reach the
  // duplicate-instance guard — the same "guards compose" behavior verified
  // directly against real Postgres (docs/PHASE_9_2.md §4/§6).
  await assert.rejects(() => submitExpenseRequestForApproval(asClient(fake), "expense-1"), ServiceError);
});

test("decideExpenseRequestApproval walks the 3-step chain (finance_manager -> secretary -> chairman) to approved", async () => {
  const fake = seed();
  await submitExpenseRequestForApproval(asClient(fake), "expense-1");

  const step1 = await decideExpenseRequestApproval(asClient(fake), {
    expenseRequestId: "expense-1",
    decision: "approve",
    actingUserId: "user-finance",
    actingUserRoleCodes: ["finance_manager"],
  });
  assert.equal(step1.workflowStatus, "pending");
  assert.equal(step1.expenseRequest.status, "pending_approval"); // unchanged mid-chain

  const step2 = await decideExpenseRequestApproval(asClient(fake), {
    expenseRequestId: "expense-1",
    decision: "approve",
    actingUserId: "user-secretary",
    actingUserRoleCodes: ["secretary"],
  });
  assert.equal(step2.workflowStatus, "pending");
  assert.equal(step2.expenseRequest.status, "pending_approval");

  const step3 = await decideExpenseRequestApproval(asClient(fake), {
    expenseRequestId: "expense-1",
    decision: "approve",
    actingUserId: "user-chairman",
    actingUserRoleCodes: ["chairman"],
  });
  assert.equal(step3.workflowStatus, "approved");
  assert.equal(step3.expenseRequest.status, "approved");
});

test("decideExpenseRequestApproval rejects and moves the request to rejected", async () => {
  const fake = seed();
  await submitExpenseRequestForApproval(asClient(fake), "expense-1");
  const result = await decideExpenseRequestApproval(asClient(fake), {
    expenseRequestId: "expense-1",
    decision: "reject",
    comment: "Not budgeted.",
    actingUserId: "user-finance",
    actingUserRoleCodes: ["finance_manager"],
  });
  assert.equal(result.workflowStatus, "rejected");
  assert.equal(result.expenseRequest.status, "rejected");
});

test("decideExpenseRequestApproval refuses a caller who doesn't hold the current step's role", async () => {
  const fake = seed();
  await submitExpenseRequestForApproval(asClient(fake), "expense-1");
  await assert.rejects(
    () =>
      decideExpenseRequestApproval(asClient(fake), {
        expenseRequestId: "expense-1",
        decision: "approve",
        actingUserId: "user-secretary",
        actingUserRoleCodes: ["secretary"], // step 1 requires finance_manager
      }),
    ServiceError
  );
});
