"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, Input } from "@ngc/ui";
import { startApplicationAction, type StartApplicationState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Starting…" : "Start my application"}
    </Button>
  );
}

/**
 * The applicant has no account and no session — the application number +
 * access token shown below on success ARE their entire credential for
 * every later visit (ARCHITECTURE.md §5.1). There is no "resend" in this
 * phase (no notification channel is wired up yet — see
 * docs/PHASE_7_2.md), so losing it means starting a new draft. Copy is
 * blunt about this on purpose.
 */
export function StartForm() {
  const [state, formAction] = useActionState<StartApplicationState, FormData>(startApplicationAction, {});
  const [copied, setCopied] = useState(false);

  if (state.result) {
    const credentialsText = `Application number: ${state.result.applicationNumber}\nAccess code: ${state.result.accessToken}`;
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-md border border-status-warning/40 bg-status-warning/10 p-4">
          <p className="mb-2 text-sm font-semibold text-ink-primary">Save this information now — it will not be shown again.</p>
          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Application number</dt>
              <dd className="font-mono text-ink-primary">{state.result.applicationNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Access code</dt>
              <dd className="break-all font-mono text-ink-primary">{state.result.accessToken}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(credentialsText);
              setCopied(true);
            }}
            className="mt-3 text-sm font-medium text-brand-700 hover:underline"
          >
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
        </div>
        <p className="text-sm text-ink-secondary">
          You&apos;ll need your application number, access code, and the email or phone number you just entered
          every time you come back to continue or check your status.
        </p>
        <Link href="/join/continue">
          <Button>Continue to my application</Button>
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input
        name="verificationContact"
        label="Email or phone number"
        hint="You'll use this alongside your access code every time you return"
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
