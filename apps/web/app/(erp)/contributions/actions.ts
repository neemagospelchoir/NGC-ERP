"use server";

import { revalidatePath } from "next/cache";
import { auth, contributions } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface ContributionsFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function readOptionalNumber(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function createCampaignAction(
  _prevState: ContributionsFormState,
  formData: FormData
): Promise<ContributionsFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    await contributions.createCampaign(supabase, {
      name: String(formData.get("name") ?? ""),
      description: readOptionalString(formData, "description"),
      targetAmount: readOptionalNumber(formData, "targetAmount"),
      deadline: readOptionalString(formData, "deadline"),
      // Acting-user id is always resolved server-side, never taken from the
      // form — same convention as assignUniformAction/recordWorkflowDecision.
      createdBy: currentUser?.id ?? null,
    });
  } catch (err) {
    if (err instanceof contributions.ServiceError) return { error: err.message };
    return { error: "Could not create the campaign." };
  }
  revalidatePath("/contributions");
  return {};
}

export async function updateCampaignAction(
  id: string,
  _prevState: ContributionsFormState,
  formData: FormData
): Promise<ContributionsFormState> {
  const supabase = await createClient();
  try {
    await contributions.updateCampaign(supabase, id, {
      name: String(formData.get("name") ?? ""),
      description: readOptionalString(formData, "description"),
      targetAmount: readOptionalNumber(formData, "targetAmount"),
      deadline: readOptionalString(formData, "deadline"),
    });
  } catch (err) {
    if (err instanceof contributions.ServiceError) return { error: err.message };
    return { error: "Could not update the campaign." };
  }
  revalidatePath("/contributions");
  revalidatePath(`/contributions/${id}`);
  return {};
}

export async function setCampaignStatusAction(id: string, to: contributions.CampaignStatus): Promise<void> {
  const supabase = await createClient();
  // No `from`/current-status parameter — `setCampaignStatus` re-reads the
  // authoritative row itself (see that function's own doc comment for why
  // trusting a caller-supplied "current status" was a real bug found in
  // this phase's security review).
  await contributions.setCampaignStatus(supabase, id, to);
  revalidatePath("/contributions");
  revalidatePath(`/contributions/${id}`);
}

export async function recordContributionAction(
  campaignId: string,
  _prevState: ContributionsFormState,
  formData: FormData
): Promise<ContributionsFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    await contributions.recordContribution(supabase, {
      campaignId,
      memberId: String(formData.get("memberId") ?? ""),
      amount: Number(formData.get("amount") ?? 0),
      contributedAt: readOptionalString(formData, "contributedAt") ?? undefined,
      paymentMethod: readOptionalString(formData, "paymentMethod"),
      reference: readOptionalString(formData, "reference"),
      notes: readOptionalString(formData, "notes"),
      recordedBy: currentUser?.id ?? null,
    });
  } catch (err) {
    if (err instanceof contributions.ServiceError) return { error: err.message };
    return { error: "Could not record the contribution." };
  }
  revalidatePath("/contributions");
  revalidatePath(`/contributions/${campaignId}`);
  return {};
}

export async function reverseContributionAction(campaignId: string, recordId: string): Promise<void> {
  const supabase = await createClient();
  await contributions.reverseContribution(supabase, recordId);
  revalidatePath("/contributions");
  revalidatePath(`/contributions/${campaignId}`);
}
