import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";

export interface AssignDepartmentInput {
  memberId: string;
  departmentId: string;
  assignmentType: "primary" | "secondary";
  /** The signed-in HR/admin user making the change — recorded as member_departments.changed_by, per spec S12 ("assignment changes must be recorded"). */
  changedBy: string;
  notes?: string | null;
}

/**
 * The one way to change a member's PRIMARY department. Three writes, not
 * one, because `members.primary_department_id` is a denormalized "current"
 * pointer and `member_departments` is the append-only historical log (spec
 * S12) — both must move together or they silently drift apart:
 *
 *   1. close out the previous current PRIMARY assignment (is_current=false,
 *      ended_at=now) so the history stays accurate;
 *   2. insert the new PRIMARY assignment row;
 *   3. update members.primary_department_id to match.
 *
 * For a SECONDARY assignment, only step 2 runs — a member can hold more
 * than one secondary department at once, and `members.primary_department_id`
 * is untouched.
 *
 * Known limitation: these are sequential PostgREST calls, not one
 * Postgres transaction — a failure between steps could leave the history
 * and the denormalized pointer briefly inconsistent. Documented rather than
 * silently assumed away; a follow-up (a small `SECURITY INVOKER` RPC
 * wrapping all three writes in one transaction) would close this if it
 * proves to matter in practice. RLS itself is unaffected either way, since
 * every statement here still runs under the caller's own RLS-scoped client.
 */
export async function assignDepartment(
  client: SupabaseClient<Database>,
  input: AssignDepartmentInput
): Promise<void> {
  if (input.assignmentType === "primary") {
    const { error: closeError } = await client
      .from("member_departments")
      .update({ is_current: false, ended_at: new Date().toISOString() })
      .eq("member_id", input.memberId)
      .eq("assignment_type", "primary")
      .eq("is_current", true);

    if (closeError) {
      throw new ServiceError("Could not close out the previous department assignment.", closeError);
    }
  }

  const { error: insertError } = await client.from("member_departments").insert({
    member_id: input.memberId,
    department_id: input.departmentId,
    assignment_type: input.assignmentType,
    is_current: true,
    changed_by: input.changedBy,
    notes: input.notes ?? null,
  });

  if (insertError) {
    throw new ServiceError("Could not record the department assignment.", insertError);
  }

  if (input.assignmentType === "primary") {
    const { error: updateError } = await client
      .from("members")
      .update({ primary_department_id: input.departmentId })
      .eq("id", input.memberId);

    if (updateError) {
      throw new ServiceError(
        "Recorded the assignment history but could not update the member's primary department. The history and current department may be out of sync — please retry or contact support.",
        updateError
      );
    }
  }
}

export async function endDepartmentAssignment(
  client: SupabaseClient<Database>,
  memberDepartmentId: string
): Promise<void> {
  const { error } = await client
    .from("member_departments")
    .update({ is_current: false, ended_at: new Date().toISOString() })
    .eq("id", memberDepartmentId);

  if (error) {
    throw new ServiceError("Could not end the department assignment.", error);
  }
}
