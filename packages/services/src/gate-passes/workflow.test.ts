import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { decideGatePassApproval, submitGatePassForApproval } from "./workflow";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

/** Mirrors the real `start_gate_pass_workflow` (0029) SQL logic closely enough for these tests — same approach as invitations/approval.test.ts's `record_workflow_decision` stub. */
function makeStartRpcStub(fake: ReturnType<typeof createFakeSupabaseClient>) {
  return async (args: Record<string, unknown>) => {
    const gatePasses = fake.__db.get("gate_passes") ?? [];
    const gatePass = gatePasses.find((g) => g.id === args.p_gate_pass_id);
    if (!gatePass) return { data: null, error: { message: "Gate pass not found" } };
    if (gatePass.status !== "pending_approval") return { data: null, error: { message: "This gate pass is no longer awaiting submission" } };

    const items = (fake.__db.get("gate_pass_items") ?? []).filter((i) => i.gate_pass_id === args.p_gate_pass_id);
    if (items.length === 0) return { data: null, error: { message: "Add at least one item before submitting a gate pass for approval" } };

    const existing = (fake.__db.get("workflow_instances") ?? []).find(
      (i) => i.record_type === "gate_pass" && i.record_id === args.p_gate_pass_id
    );
    if (existing) return { data: null, error: { message: "An approval workflow has already been started for this gate pass" } };

    const definition = (fake.__db.get("workflow_definitions") ?? []).find((d) => d.record_type === "gate_pass" && d.is_active);
    if (!definition) return { data: null, error: { message: "No active approval workflow is configured for gate passes" } };

    const instances = fake.__db.get("workflow_instances") ?? [];
    const instance = {
      id: `wf-${instances.length}`,
      workflow_definition_id: definition.id,
      record_type: "gate_pass",
      record_id: args.p_gate_pass_id,
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

/** Mirrors the real `record_workflow_decision` (0028) SQL logic — same pattern as invitations/approval.test.ts. */
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

function seed(status = "pending_approval") {
  const fake = createFakeSupabaseClient({
    gate_passes: [{ id: "gp-1", gate_pass_number: "GP-2026-0001", event_id: "event-1", person_responsible_id: "user-tech", status }] as FakeRow[],
    gate_pass_items: [{ id: "item-1", gate_pass_id: "gp-1", asset_id: "asset-1", quantity: 1 }] as FakeRow[],
    workflow_definitions: [{ id: "def-gate-pass", record_type: "gate_pass", name: "Standard Gate Pass Approval", is_active: true, created_at: "2026-01-01T00:00:00.000Z" }] as FakeRow[],
    workflow_definition_steps: [
      { id: "s1", workflow_definition_id: "def-gate-pass", step_order: 1, required_role_code: "technical_manager", required_user_id: null },
      { id: "s2", workflow_definition_id: "def-gate-pass", step_order: 2, required_role_code: "secretary", required_user_id: null },
    ] as FakeRow[],
    workflow_instances: [] as FakeRow[],
    workflow_step_decisions: [] as FakeRow[],
  });
  const startStub = makeStartRpcStub(fake);
  const decisionStub = makeDecisionRpcStub(fake);
  return {
    ...fake,
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      if (fn === "start_gate_pass_workflow") return startStub(args);
      if (fn === "record_workflow_decision") return decisionStub(args);
      return { data: null, error: { message: `unstubbed rpc "${fn}"` } };
    },
  } as unknown as ReturnType<typeof createFakeSupabaseClient>;
}

test("submitGatePassForApproval starts the workflow instance", async () => {
  const fake = seed();
  await submitGatePassForApproval(asClient(fake), "gp-1");
  assert.equal((fake.__db.get("workflow_instances") ?? []).length, 1);
});

test("submitGatePassForApproval refuses a gate pass with no items", async () => {
  const fake = seed();
  fake.__db.set("gate_pass_items", []);
  await assert.rejects(() => submitGatePassForApproval(asClient(fake), "gp-1"), ServiceError);
});

test("submitGatePassForApproval refuses to start a second workflow for the same gate pass", async () => {
  const fake = seed();
  await submitGatePassForApproval(asClient(fake), "gp-1");
  await assert.rejects(() => submitGatePassForApproval(asClient(fake), "gp-1"), ServiceError);
});

test("decideGatePassApproval walks the 2-step chain (technical_manager then secretary) to approved", async () => {
  const fake = seed();
  await submitGatePassForApproval(asClient(fake), "gp-1");

  const step1 = await decideGatePassApproval(asClient(fake), {
    gatePassId: "gp-1",
    decision: "approve",
    actingUserId: "user-tech",
    actingUserRoleCodes: ["technical_manager"],
  });
  assert.equal(step1.workflowStatus, "pending");
  assert.equal(step1.gatePass.status, "pending_approval"); // unchanged mid-chain

  const step2 = await decideGatePassApproval(asClient(fake), {
    gatePassId: "gp-1",
    decision: "approve",
    actingUserId: "user-secretary",
    actingUserRoleCodes: ["secretary"],
  });
  assert.equal(step2.workflowStatus, "approved");
  assert.equal(step2.gatePass.status, "approved");
});

test("decideGatePassApproval rejects and moves the gate pass to rejected", async () => {
  const fake = seed();
  await submitGatePassForApproval(asClient(fake), "gp-1");
  const result = await decideGatePassApproval(asClient(fake), {
    gatePassId: "gp-1",
    decision: "reject",
    comment: "Equipment needed elsewhere.",
    actingUserId: "user-tech",
    actingUserRoleCodes: ["technical_manager"],
  });
  assert.equal(result.workflowStatus, "rejected");
  assert.equal(result.gatePass.status, "rejected");
});

test("decideGatePassApproval refuses a caller who doesn't hold the current step's role", async () => {
  const fake = seed();
  await submitGatePassForApproval(asClient(fake), "gp-1");
  await assert.rejects(
    () =>
      decideGatePassApproval(asClient(fake), {
        gatePassId: "gp-1",
        decision: "approve",
        actingUserId: "user-x",
        actingUserRoleCodes: ["secretary"], // step 1 needs technical_manager
      }),
    /not the required approver/
  );
});
