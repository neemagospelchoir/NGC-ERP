"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input } from "@ngc/ui";
import { requestPasswordResetAction, type ForgotPasswordFormState } from "./actions";

const initialState: ForgotPasswordFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Send reset link"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialState);

  if (state.submitted) {
    return (
      <p className="text-sm text-ink-secondary">
        If an account exists for that email, a password reset link has been sent. It expires after a
        limited time, so use it soon.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Input name="email" type="email" label="Email" autoComplete="username" required />

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
