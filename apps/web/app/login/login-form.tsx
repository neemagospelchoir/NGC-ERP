"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, Input } from "@ngc/ui";
import { signInAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />

      <Input name="identifier" type="text" label="Email or Username" autoComplete="username" required />
      <Input name="password" type="password" label="Password" autoComplete="current-password" required />

      {state.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {state.error}
        </p>
      )}

      <SubmitButton />

      <div className="flex flex-col items-center gap-1 text-center text-sm text-ink-secondary">
        <Link href="/forgot-password" className="underline hover:text-ink-primary">
          Forgot your password?
        </Link>
        <span>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="underline hover:text-ink-primary">
            Sign up
          </Link>
        </span>
      </div>
    </form>
  );
}
