"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, Input } from "@ngc/ui";
import { signUpAction, type SignUpFormState } from "./actions";

const initialState: SignUpFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialState);

  if (state.needsEmailConfirmation) {
    return (
      <p className="text-sm text-ink-secondary">
        Almost there — we sent a confirmation link to your email. Click it to activate your account, then{" "}
        <Link href="/login" className="underline hover:text-ink-primary">
          sign in
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Input name="displayName" type="text" label="Full name" autoComplete="name" required />
      <Input name="email" type="email" label="Email" autoComplete="email" required />
      <Input
        name="username"
        type="text"
        label="Username (optional)"
        autoComplete="username"
        pattern="[A-Za-z0-9_.-]{3,32}"
        title="3-32 characters: letters, numbers, dots, dashes, or underscores."
      />
      <Input name="password" type="password" label="Password" autoComplete="new-password" required minLength={8} />
      <Input
        name="confirmPassword"
        type="password"
        label="Confirm password"
        autoComplete="new-password"
        required
        minLength={8}
      />

      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}

      <SubmitButton />

      <p className="text-center text-sm text-ink-secondary">
        Already have an account?{" "}
        <Link href="/login" className="underline hover:text-ink-primary">
          Sign in
        </Link>
      </p>
    </form>
  );
}
