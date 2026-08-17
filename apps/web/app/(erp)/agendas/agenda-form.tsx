"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Checkbox, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { AgendasFormState } from "./actions";
import { ELIGIBLE_VOTER_SCOPE_OPTIONS, VOTING_METHOD_OPTIONS } from "./status";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 16);
}

/**
 * `eligibleDepartmentId`/`eligibleFamilyId`/`eligibleUserIds` are plain
 * paste-the-id fields, the established convention (Announcements,
 * Notifications) rather than a searchable picker. Unlike Announcements'
 * `target_audience`, every option here (including `leadership`) is backed
 * by a real, enforced eligibility check in `votes_insert_self` RLS (0034)
 * — see status.ts's own doc comment.
 */
export function AgendaForm({
  action,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: AgendasFormState, formData: FormData) => Promise<AgendasFormState>;
  initial?: {
    title?: string;
    description?: string | null;
    votingMethod?: string;
    eligibleVoterScope?: string;
    eligibleDepartmentId?: string | null;
    eligibleFamilyId?: string | null;
    eligibleUserIds?: string[];
    isAnonymous?: boolean;
    votingDeadline?: string;
  };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input name="title" label="Title" defaultValue={initial?.title ?? ""} required />
      <Textarea name="description" label="Description" hint="Optional" defaultValue={initial?.description ?? ""} />
      <Select
        name="votingMethod"
        label="Voting method"
        options={VOTING_METHOD_OPTIONS as SelectOption[]}
        defaultValue={initial?.votingMethod ?? "yes_no_abstain"}
      />
      <Select
        name="eligibleVoterScope"
        label="Who can vote"
        options={ELIGIBLE_VOTER_SCOPE_OPTIONS as SelectOption[]}
        defaultValue={initial?.eligibleVoterScope ?? "all_members"}
      />
      <Input
        name="eligibleDepartmentId"
        label="Department ID"
        hint="Required when voter scope is 'A specific department'"
        defaultValue={initial?.eligibleDepartmentId ?? ""}
      />
      <Input
        name="eligibleFamilyId"
        label="Family ID"
        hint="Required when voter scope is 'A specific family'"
        defaultValue={initial?.eligibleFamilyId ?? ""}
      />
      <Textarea
        name="eligibleUserIds"
        label="Eligible member user IDs"
        hint="Required when voter scope is 'Specific members' — one per line or comma-separated"
        defaultValue={(initial?.eligibleUserIds ?? []).join("\n")}
      />
      <Input
        name="votingDeadline"
        label="Voting deadline"
        type="datetime-local"
        defaultValue={toDatetimeLocal(initial?.votingDeadline)}
        required
      />
      <Checkbox name="isAnonymous" label="Anonymous vote (only the tally is shown; individual ballots are never revealed except to Super Admin)" defaultChecked={initial?.isAnonymous ?? false} />
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  );
}
