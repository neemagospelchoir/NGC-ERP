"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@ngc/ui";
import type { agendas } from "@ngc/services";
import type { AgendasFormState } from "./actions";
import { choiceLabel } from "./status";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Recording your vote…" : "Cast vote"}
    </Button>
  );
}

/**
 * A plain native radio group (not `@ngc/ui`'s `RadioGroup`, which requires
 * controlled `value`/`onChange` state — this form stays an uncontrolled
 * Server Action form, the same shape every other write form in this
 * codebase uses) offering only the choices `votingMethod` actually allows:
 * `yes_no` agendas never offer "Abstain".
 */
export function VoteForm({ votingMethod, action }: { votingMethod: agendas.VotingMethod; action: (prevState: AgendasFormState, formData: FormData) => Promise<AgendasFormState> }) {
  const [state, formAction] = useActionState(action, {});
  const choices: agendas.VoteChoice[] = votingMethod === "yes_no" ? ["yes", "no"] : ["yes", "no", "abstain"];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink-primary">Your vote</legend>
        <div className="flex flex-col gap-1.5">
          {choices.map((choice) => (
            <label key={choice} className="inline-flex items-center gap-2 text-sm text-ink-primary">
              <input
                type="radio"
                name="choice"
                value={choice}
                defaultChecked={choice === choices[0]}
                required
                className="h-4 w-4 border border-hairline text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
              />
              {choiceLabel(choice)}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
