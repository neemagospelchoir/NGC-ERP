import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { startInvitationApproval, decideInvitationApproval } from "./approval";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function invitationRow(status: string) {
  return {
    id: "inv-1",
    invitation_number: "INV-2026-0001",
    organizer_name: "AICT Kinondoni",
    event_name: "Crown TV Recording",
    proposed_date: "2026-03-01",
    proposed_time: "18:00",
    venue: "Chang'ombe",
    location: "Dar es Salaam",
    access_token_hash: "hash",
    verification_contact: "organizer@church.org",
    status,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

/** Mirrors the real `record_workflow_decision` (0028) SQL logic closely enough for these tests — see approval.test.ts's own doc note. */
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

function seed(status: string) {
  const fake = createFakeSupabaseClient({
    invitations: [invitationRow(status)],
    events: [],
    comments: [],
    workflow_definitions: [
      { id: "def-invitation", record_type: "invitation", name: "Standard Invitation Approval", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
    ],
    workflow_definition_steps: [
      { id: "s1", workflow_definition_id: "def-invitation", step_order: 1, required_role_code: "secretary", required_user_id: null },
      { id: "s2", workflow_definition_id: "def-invitation", step_order: 2, required_role_code: "technical_manager", required_user_id: null },
    ],
    workflow_instances: [],
    workflow_step_decisions: [],
  });
  // Same "wrap the fake client's rpc()" pattern as discipline/record-action.test.ts —
  // simpler than threading a getter through rpcStubs for a stub that needs
  // to read the fake's own __db.
  const decisionStub = makeDecisionRpcStub(fake);
  return {
    ...fake,
    rpc: async (fn: string, args: Record<string, unknown> = {}) => (fn === "record_workflow_decision" ? decisionStub(args) : { data: null, error: { message: `unstubbed rpc "${fn}"` } }),
  } as unknown as ReturnType<typeof createFakeSupabaseClient>;
}

test("startInvitationApproval starts a workflow and moves the invitation to pending_management_approval", async () => {
  const fake = seed("under_review");
  const result = await startInvitationApproval(asClient(fake), "inv-1");
  assert.equal(result.status, "pending_management_approval");
  assert.equal((fake.__db.get("workflow_instances") ?? []).length, 1);
});

test("decideInvitationApproval walks a full 2-step chain to approved and creates the event", async () => {
  const fake = seed("under_review");
  await startInvitationApproval(asClient(fake), "inv-1");

  const step1 = await decideInvitationApproval(asClient(fake), {
    invitationId: "inv-1",
    decision: "approve",
    actingUserId: "user-secretary",
    actingUserRoleCodes: ["secretary"],
  });
  assert.equal(step1.workflowStatus, "pending");
  assert.equal(step1.invitation.status, "pending_management_approval"); // unchanged mid-chain

  const step2 = await decideInvitationApproval(asClient(fake), {
    invitationId: "inv-1",
    decision: "approve",
    actingUserId: "user-technical",
    actingUserRoleCodes: ["technical_manager"],
  });
  assert.equal(step2.workflowStatus, "approved");
  assert.equal(step2.invitation.status, "approved");

  const events = fake.__db.get("events") ?? [];
  assert.equal(events.length, 1);
  assert.equal(events[0]?.invitation_id, "inv-1");
});

test("decideInvitationApproval rejects and declines the invitation", async () => {
  const fake = seed("under_review");
  await startInvitationApproval(asClient(fake), "inv-1");
  const result = await decideInvitationApproval(asClient(fake), {
    invitationId: "inv-1",
    decision: "reject",
    comment: "Date conflicts with a prior commitment.",
    actingUserId: "user-secretary",
    actingUserRoleCodes: ["secretary"],
  });
  assert.equal(result.workflowStatus, "rejected");
  assert.equal(result.invitation.status, "declined");
});

test("decideInvitationApproval on request_changes moves to pending_information and posts an organizer-visible comment", async () => {
  const fake = seed("under_review");
  await startInvitationApproval(asClient(fake), "inv-1");
  const result = await decideInvitationApproval(asClient(fake), {
    invitationId: "inv-1",
    decision: "request_changes",
    comment: "Please confirm the venue capacity.",
    actingUserId: "user-secretary",
    actingUserRoleCodes: ["secretary"],
  });
  assert.equal(result.invitation.status, "pending_information");

  const comments = fake.__db.get("comments") ?? [];
  assert.equal(comments.length, 1);
  assert.equal(comments[0]?.is_internal, false);
});

test("decideInvitationApproval refuses a caller who doesn't hold the current step's role", async () => {
  const fake = seed("under_review");
  await startInvitationApproval(asClient(fake), "inv-1");
  await assert.rejects(
    () =>
      decideInvitationApproval(asClient(fake), {
        invitationId: "inv-1",
        decision: "approve",
        actingUserId: "user-x",
        actingUserRoleCodes: ["technical_manager"], // step 1 needs secretary
      }),
    /not the required approver/
  );
});

test("startInvitationApproval resumes (does not duplicate) an existing workflow instance after a request_changes cycle", async () => {
  const fake = seed("under_review");
  await startInvitationApproval(asClient(fake), "inv-1");
  await decideInvitationApproval(asClient(fake), {
    invitationId: "inv-1",
    decision: "request_changes",
    comment: "Fix the venue.",
    actingUserId: "user-secretary",
    actingUserRoleCodes: ["secretary"],
  });

  // Organizer resubmits (out of scope here — simulated directly) and HR walks it back through review:
  fake.__db.set("invitations", (fake.__db.get("invitations") ?? []).map((r) => ({ ...r, status: "under_review" })));

  const resumed = await startInvitationApproval(asClient(fake), "inv-1");
  assert.equal(resumed.status, "pending_management_approval");
  assert.equal((fake.__db.get("workflow_instances") ?? []).length, 1); // still exactly one instance
});
