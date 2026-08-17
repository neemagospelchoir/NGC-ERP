"use server";

import { revalidatePath } from "next/cache";
import { agendas, auth } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface AgendasFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function readUserIds(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? "")
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function createAgendaAction(_prevState: AgendasFormState, formData: FormData): Promise<AgendasFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    if (!currentUser) throw new agendas.ServiceError("You must be signed in.");
    const scope = String(formData.get("eligibleVoterScope") ?? "all_members") as agendas.EligibleVoterScope;
    await agendas.createAgenda(supabase, {
      title: String(formData.get("title") ?? ""),
      description: readOptionalString(formData, "description"),
      votingMethod: (String(formData.get("votingMethod") ?? "yes_no_abstain") as agendas.VotingMethod) || undefined,
      eligibleVoterScope: scope,
      eligibleDepartmentId: readOptionalString(formData, "eligibleDepartmentId"),
      eligibleFamilyId: readOptionalString(formData, "eligibleFamilyId"),
      eligibleUserIds: readUserIds(formData, "eligibleUserIds"),
      isAnonymous: formData.get("isAnonymous") === "on",
      votingDeadline: String(formData.get("votingDeadline") ?? ""),
      // Acting-user id is always resolved server-side, never taken from the
      // form — same convention as createAnnouncementAction/recordContributionAction.
      createdBy: currentUser.id,
    });
  } catch (err) {
    if (err instanceof agendas.ServiceError) return { error: err.message };
    return { error: "Could not create the agenda item." };
  }
  revalidatePath("/agendas");
  return {};
}

export async function updateAgendaAction(id: string, _prevState: AgendasFormState, formData: FormData): Promise<AgendasFormState> {
  const supabase = await createClient();
  try {
    const scope = String(formData.get("eligibleVoterScope") ?? "all_members") as agendas.EligibleVoterScope;
    await agendas.updateAgenda(supabase, id, {
      title: String(formData.get("title") ?? ""),
      description: readOptionalString(formData, "description"),
      votingMethod: (String(formData.get("votingMethod") ?? "yes_no_abstain") as agendas.VotingMethod) || undefined,
      eligibleVoterScope: scope,
      eligibleDepartmentId: readOptionalString(formData, "eligibleDepartmentId"),
      eligibleFamilyId: readOptionalString(formData, "eligibleFamilyId"),
      eligibleUserIds: readUserIds(formData, "eligibleUserIds"),
      isAnonymous: formData.get("isAnonymous") === "on",
      votingDeadline: String(formData.get("votingDeadline") ?? ""),
    });
  } catch (err) {
    if (err instanceof agendas.ServiceError) return { error: err.message };
    return { error: "Could not update the agenda item." };
  }
  revalidatePath("/agendas");
  revalidatePath(`/agendas/${id}`);
  return {};
}

export async function setAgendaStatusAction(id: string, to: agendas.AgendaStatus): Promise<void> {
  const supabase = await createClient();
  await agendas.setAgendaStatus(supabase, id, to);
  revalidatePath("/agendas");
  revalidatePath(`/agendas/${id}`);
}

export async function castVoteAction(agendaId: string, _prevState: AgendasFormState, formData: FormData): Promise<AgendasFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    if (!currentUser) throw new agendas.ServiceError("You must be signed in to vote.");
    await agendas.castVote(supabase, {
      agendaId,
      // Resolved server-side, never taken from the form — `votes_insert_self`
      // RLS requires it to equal auth.uid() regardless, but the service
      // layer's own contract should never even suggest a client picks this.
      voterId: currentUser.id,
      choice: String(formData.get("choice") ?? "") as agendas.VoteChoice,
    });
  } catch (err) {
    if (err instanceof agendas.ServiceError) return { error: err.message };
    return { error: "Could not record your vote." };
  }
  revalidatePath(`/agendas/${agendaId}`);
  return {};
}
