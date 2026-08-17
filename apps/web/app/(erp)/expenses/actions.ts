"use server";

import { revalidatePath } from "next/cache";
import { auth, expenses } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface ExpenseFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

/**
 * Any signed-in member may create their own expense request — matching
 * `expense_requests_insert_self` RLS (0014) exactly, not a permission-gated
 * management action. `requestedBy` is always resolved server-side from the
 * authenticated session, never taken from the form.
 */
export async function createExpenseRequestAction(_prevState: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    if (!currentUser) return { error: "You must be signed in." };
    await expenses.createExpenseRequest(supabase, {
      description: String(formData.get("description") ?? ""),
      amount: Number(formData.get("amount") ?? 0),
      category: readOptionalString(formData, "category"),
      departmentId: readOptionalString(formData, "departmentId"),
      eventId: readOptionalString(formData, "eventId"),
      supportingDocumentId: readOptionalString(formData, "supportingDocumentId"),
      requestedBy: currentUser.id,
    });
  } catch (err) {
    if (err instanceof expenses.ServiceError) return { error: err.message };
    return { error: "Could not create the expense request." };
  }
  revalidatePath("/expenses");
  return {};
}

export async function updateExpenseRequestAction(
  id: string,
  _prevState: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const supabase = await createClient();
  try {
    await expenses.updateExpenseRequest(supabase, id, {
      description: String(formData.get("description") ?? ""),
      amount: Number(formData.get("amount") ?? 0),
      category: readOptionalString(formData, "category"),
      departmentId: readOptionalString(formData, "departmentId"),
      eventId: readOptionalString(formData, "eventId"),
      supportingDocumentId: readOptionalString(formData, "supportingDocumentId"),
    });
  } catch (err) {
    if (err instanceof expenses.ServiceError) return { error: err.message };
    return { error: "Could not update the expense request." };
  }
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return {};
}

export async function submitExpenseRequestForApprovalAction(
  id: string,
  _prevState: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  void formData;
  const supabase = await createClient();
  try {
    await expenses.submitExpenseRequestForApproval(supabase, id);
  } catch (err) {
    if (err instanceof expenses.ServiceError) return { error: err.message };
    return { error: "Could not submit the expense request for approval." };
  }
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  revalidatePath("/approvals");
  return {};
}

export async function decideExpenseRequestApprovalAction(
  id: string,
  _prevState: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  if (!currentUser) return { error: "You must be signed in." };

  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approve" && decision !== "reject" && decision !== "request_changes") {
    return { error: "Choose a decision." };
  }

  try {
    await expenses.decideExpenseRequestApproval(supabase, {
      expenseRequestId: id,
      decision,
      comment: readOptionalString(formData, "comment"),
      actingUserId: currentUser.id,
      actingUserRoleCodes: currentUser.roles.map((r) => r.code),
    });
  } catch (err) {
    if (err instanceof expenses.ServiceError) return { error: err.message };
    return { error: "Could not record the decision." };
  }
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  revalidatePath("/approvals");
  return {};
}

export async function markExpensePaidAction(id: string, _prevState: ExpenseFormState, formData: FormData): Promise<ExpenseFormState> {
  const supabase = await createClient();
  try {
    await expenses.markExpensePaid(supabase, id, readOptionalString(formData, "paymentReference"));
  } catch (err) {
    if (err instanceof expenses.ServiceError) return { error: err.message };
    return { error: "Could not mark the expense request paid." };
  }
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return {};
}

export async function closeExpenseRequestAction(id: string): Promise<void> {
  const supabase = await createClient();
  await expenses.closeExpenseRequest(supabase, id);
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
}
