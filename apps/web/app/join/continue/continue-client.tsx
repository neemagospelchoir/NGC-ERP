"use client";

import { useRef, useState, useTransition, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Card, CardHeader, CardTitle, Checkbox, Input, Select, StatusPill, Textarea } from "@ngc/ui";
import type { applications } from "@ngc/services";
import {
  loadApplicationAction,
  saveApplicationDraftAction,
  submitApplicationAction,
  type SaveApplicationState,
} from "../actions";

interface Credentials {
  applicationNumber: string;
  accessToken: string;
  verificationContact: string;
}

const STATUS_LABEL: Record<applications.ApplicationStatus, string> = {
  draft: "Draft — not yet submitted",
  submitted: "Submitted — awaiting review",
  incomplete: "More information needed",
  pending_review: "Under review",
  under_verification: "Under verification",
  pending_approval: "Pending a final decision",
  approved: "Approved",
  rejected: "Not approved",
  cancelled: "Cancelled",
  probation: "Approved — in probation",
  probation_completed: "Probation completed",
  probation_failed: "Probation not completed",
  converted_to_member: "Welcome — you are a full member",
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Calls loadApplicationAction directly (a Server Action is just an async
 * function — it doesn't have to be wired through a <form action={...}>/
 * useActionState to be called) rather than via useActionState, specifically
 * because useActionState only exposes the ACTION's return value, not the
 * FormData that was submitted — and the next step needs both the
 * credentials just entered (to carry forward as hidden fields on every
 * later save/submit, since there is no session to remember them for us)
 * and the resulting view together, in one place, without a browser-storage
 * side-channel.
 */
function VerifyForm({ onVerified }: { onVerified: (creds: Credentials, view: applications.ApplicantView) => void }) {
  const [applicationNumber, setApplicationNumber] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [verificationContact, setVerificationContact] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const creds: Credentials = { applicationNumber, accessToken, verificationContact };
    startTransition(async () => {
      const formData = new FormData();
      formData.set("applicationNumber", creds.applicationNumber);
      formData.set("accessToken", creds.accessToken);
      formData.set("verificationContact", creds.verificationContact);
      const result = await loadApplicationAction({}, formData);
      if (!result.view) {
        setError(result.error ?? "Could not verify that application.");
        return;
      }
      onVerified(creds, result.view);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Application number"
        placeholder="APP-2026-0001"
        value={applicationNumber}
        onChange={(e) => setApplicationNumber(e.target.value)}
        required
      />
      <Input label="Access code" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} required />
      <Input
        label="Email or phone number used at registration"
        value={verificationContact}
        onChange={(e) => setVerificationContact(e.target.value)}
        required
      />
      {error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Verifying…" : "Continue"}
      </Button>
    </form>
  );
}

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

function HiddenCredentialFields({ creds }: { creds: Credentials }) {
  return (
    <>
      <input type="hidden" name="applicationNumber" value={creds.applicationNumber} />
      <input type="hidden" name="accessToken" value={creds.accessToken} />
      <input type="hidden" name="verificationContact" value={creds.verificationContact} />
    </>
  );
}

function ApplicationForm({ creds, initialView }: { creds: Credentials; initialView: applications.ApplicantView }) {
  const [view, setView] = useState(initialView);
  const [saveState, saveAction] = useActionState<SaveApplicationState, FormData>(saveApplicationDraftAction, {});
  const [submitState, submitAction] = useActionState<SaveApplicationState, FormData>(submitApplicationAction, {});

  // Sync whichever action last produced a new view into `view`, tracked
  // during render (React supports this specific pattern — updating state
  // during render, gated so it runs at most once per genuinely new value —
  // see https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  // Gating each branch against ITS OWN last-seen ref (not against the
  // shared `view`) matters: saveAction and submitAction each hold their
  // own stable-until-resubmitted result object, so after a submit,
  // saveState.view is still the earlier save's (now-stale) object — a
  // shared comparison would see it as "different from view" forever and
  // fight with the submit branch on every render (an infinite loop/React
  // error #301), which is exactly what an earlier version of this
  // component did.
  const lastSaveView = useRef(saveState.view);
  const lastSubmitView = useRef(submitState.view);
  if (saveState.view !== lastSaveView.current) {
    lastSaveView.current = saveState.view;
    if (saveState.view) setView(saveState.view);
  }
  if (submitState.view !== lastSubmitView.current) {
    lastSubmitView.current = submitState.view;
    if (submitState.view) setView(submitState.view);
  }
  const latest = view;

  const editable = latest.status === "draft" || latest.status === "incomplete";
  const { personal, church, education, professional, choirHistory, musical } = latest.formData;

  if (!editable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application {creds.applicationNumber}</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <StatusPill tone="neutral" label={STATUS_LABEL[latest.status]} />
          <p className="text-sm text-ink-secondary">
            {personal.firstName} {personal.lastName} — {latest.completionPercentage}% complete.
          </p>
          {latest.missingFields.length > 0 && (
            <div>
              <p className="text-sm font-medium text-ink-primary">Notes from the review team:</p>
              <ul className="ml-4 list-disc text-sm text-ink-secondary">
                {latest.missingFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <form action={saveAction} className="flex flex-col gap-6">
      <HiddenCredentialFields creds={creds} />
      <Card>
        <CardHeader>
          <CardTitle>Application {creds.applicationNumber}</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-2">
          <StatusPill tone={latest.status === "incomplete" ? "warning" : "neutral"} label={STATUS_LABEL[latest.status]} />
          <p className="text-sm text-ink-secondary">{latest.completionPercentage}% complete</p>
          {latest.missingFields.length > 0 && (
            <ul className="ml-4 list-disc text-sm text-status-serious">
              {latest.missingFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="firstName" label="First name" defaultValue={personal.firstName} required />
          <Input name="lastName" label="Last name" defaultValue={personal.lastName} required />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="middleName" label="Middle name" hint="Optional" defaultValue={personal.middleName} />
          <Input name="preferredName" label="Preferred name" hint="Optional" defaultValue={personal.preferredName} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select name="gender" label="Gender" placeholder="Select…" options={GENDER_OPTIONS} defaultValue={personal.gender} required />
          <Input name="dateOfBirth" type="date" label="Date of birth" defaultValue={personal.dateOfBirth} required />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="phone" label="Phone" defaultValue={personal.phone} required />
          <Input name="email" type="email" label="Email" defaultValue={personal.email} required />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="whatsappNumber" label="WhatsApp number" hint="Optional" defaultValue={personal.whatsappNumber} />
          <Input name="nationality" label="Nationality" hint="Optional" defaultValue={personal.nationality} />
        </div>
        <div className="mt-4">
          <Textarea name="physicalAddress" label="Physical address" defaultValue={personal.physicalAddress} required />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="region" label="Region" hint="Optional" defaultValue={personal.region} />
          <Input name="district" label="District" hint="Optional" defaultValue={personal.district} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="emergencyContactName" label="Emergency contact name" defaultValue={personal.emergencyContactName} required />
          <Input name="emergencyContactPhone" label="Emergency contact phone" defaultValue={personal.emergencyContactPhone} required />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Church background</CardTitle>
        </CardHeader>
        <Input name="currentChurch" label="Current church" defaultValue={church.currentChurch} required />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="churchLocation" label="Church location" hint="Optional" defaultValue={church.churchLocation} />
          <Input name="pastorName" label="Pastor's name" hint="Optional" defaultValue={church.pastorName} />
        </div>
        <div className="mt-4">
          <Textarea name="churchMembershipInfo" label="Church membership info" hint="Optional" defaultValue={church.churchMembershipInfo} />
        </div>
        <div className="mt-4">
          <Textarea name="referralInfo" label="How did you hear about NGC?" hint="Optional" defaultValue={church.referralInfo} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Professional background</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="profession" label="Profession" hint="Optional" defaultValue={professional.profession} />
          <Input name="employer" label="Employer" hint="Optional" defaultValue={professional.employer} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Choir history</CardTitle>
        </CardHeader>
        <Checkbox
          name="previouslyChoirMember"
          label="I have been a member of a choir before"
          defaultChecked={choirHistory.previouslyChoirMember}
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="previousChoirName" label="Previous choir name" hint="Optional" defaultValue={choirHistory.previousChoirName} />
          <Input name="previousChoirDuration" label="Duration" hint="Optional" defaultValue={choirHistory.previousChoirDuration} />
        </div>
        <div className="mt-4">
          <Textarea
            name="previousChoirResponsibilities"
            label="Responsibilities held"
            hint="Optional"
            defaultValue={choirHistory.previousChoirResponsibilities}
          />
        </div>
        <div className="mt-4">
          <Textarea name="previousChoirLeaveReason" label="Reason for leaving" hint="Optional" defaultValue={choirHistory.previousChoirLeaveReason} />
        </div>
        <div className="mt-4">
          <Textarea name="musicalExperience" label="Musical experience" hint="Optional" defaultValue={choirHistory.musicalExperience} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Musical information</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="vocalCategory" label="Vocal category" hint="e.g. Soprano, Alto, Tenor, Bass" defaultValue={musical.vocalCategory} />
          <Input name="instrument" label="Instrument" hint="Optional" defaultValue={musical.instrument} />
        </div>
        <div className="mt-4">
          <Textarea name="musicTraining" label="Music training" hint="Optional" defaultValue={musical.musicTraining} />
        </div>
        <div className="mt-4">
          <Textarea
            name="previousPerformanceExperience"
            label="Previous performance experience"
            hint="Optional"
            defaultValue={musical.previousPerformanceExperience}
          />
        </div>
      </Card>

      {saveState.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {saveState.error}
        </p>
      )}
      {saveState.success && <p className="text-sm text-status-good">Saved.</p>}

      <div className="flex gap-3">
        <SubmitButton label="Save progress" pendingLabel="Saving…" />
        <button
          type="submit"
          formAction={submitAction}
          className="inline-flex h-10 items-center justify-center rounded-md border border-brand-300 bg-transparent px-4 text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          Save &amp; submit application
        </button>
      </div>
      {submitState.error && (
        <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
          <span aria-hidden="true">⚠</span>
          {submitState.error}
        </p>
      )}
    </form>
  );
}

export function ContinueClient() {
  const [verified, setVerified] = useState<{ creds: Credentials; view: applications.ApplicantView } | null>(null);

  if (!verified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify your application</CardTitle>
        </CardHeader>
        <p className="mb-4 text-sm text-ink-secondary">
          Enter the application number and access code you were given when you started, along with the email or
          phone number you registered with.
        </p>
        <VerifyForm onVerified={(creds, view) => setVerified({ creds, view })} />
      </Card>
    );
  }

  return <ApplicationForm creds={verified.creds} initialView={verified.view} />;
}
