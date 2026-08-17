"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input } from "@ngc/ui";
import { updatePasswordAction, type ResetPasswordFormState } from "./actions";

const initialState: ResetPasswordFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Set new password"}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Input
        name="password"
        type="password"
        label="New password"
        hint="At least 8 characters."
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Input
        name="confirmPassword"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        minLength={8}
        required
      />

      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
