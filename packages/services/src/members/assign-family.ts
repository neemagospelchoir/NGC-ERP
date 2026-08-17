import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";

export interface AssignFamilyInput {
  memberId: string;
  familyId: string;
  changedBy: string;
  notes?: string | null;
}

/**
 * The one way to change a member's family (a member belongs to exactly one
 * choir family at a time, unlike departments — no primary/secondary split
 * here). Same three-step shape as assignDepartment's primary-department
 * path, and the same known non-atomicity limitation — see that file's doc
 * comment for the full rationale.
 */
export async function assignFamily(client: SupabaseClient<Database>, input: AssignFamilyInput): Promise<void> {
  const { error: closeError } = await client
    .from("member_families")
    .update({ is_current: false, ended_at: new Date().toISOString() })
    .eq("member_id", input.memberId)
    .eq("is_current", true);

  if (closeError) {
    throw new ServiceError("Could not close out the previous family assignment.", closeError);
  }

  const { error: insertError } = await client.from("member_families").insert({
    member_id: input.memberId,
    family_id: input.familyId,
    is_current: true,
    changed_by: input.changedBy,
    notes: input.notes ?? null,
  });

  if (insertError) {
    throw new ServiceError("Could not record the family assignment.", insertError);
  }

  const { error: updateError } = await client
    .from("members")
    .update({ family_id: input.familyId })
    .eq("id", input.memberId);

  if (updateError) {
    throw new ServiceError(
      "Recorded the assignment history but could not update the member's family. The history and current family may be out of sync — please retry or contact support.",
      updateError
    );
  }
}
