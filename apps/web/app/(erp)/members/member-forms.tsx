"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Select, Textarea, type SelectOption } from "@ngc/ui";
import type { AssignmentFormState, MemberFormState } from "./actions";
import { MEMBERSHIP_STATUS_OPTIONS } from "./status";

const GENDER_OPTIONS: SelectOption[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-center gap-1 text-sm text-status-critical">
      <span aria-hidden="true">⚠</span>
      {error}
    </p>
  );
}

interface MemberDetailLike {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  gender: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  physicalAddress: string | null;
  region: string | null;
  district: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

/** The contact-info fields shared between the self-service form and the HR record form — kept as one set of inputs so the two forms never silently diverge on what "contact info" means. */
function ContactInfoFields({ member }: { member: MemberDetailLike }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="firstName" label="First name" defaultValue={member.firstName} required />
        <Input name="lastName" label="Last name" defaultValue={member.lastName} required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="preferredName" label="Preferred name" hint="Optional" defaultValue={member.preferredName ?? ""} />
        <Select
          name="gender"
          label="Gender"
          placeholder="Select…"
          options={GENDER_OPTIONS}
          defaultValue={member.gender ?? ""}
        />
      </div>
      <Input name="nationality" label="Nationality" hint="Optional" defaultValue={member.nationality ?? ""} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="email" type="email" label="Email" hint="Optional" defaultValue={member.email ?? ""} />
        <Input name="phone" label="Phone" hint="Optional" defaultValue={member.phone ?? ""} />
      </div>
      <Input
        name="whatsappNumber"
        label="WhatsApp number"
        hint="Optional"
        defaultValue={member.whatsappNumber ?? ""}
      />
      <Textarea
        name="physicalAddress"
        label="Physical address"
        hint="Optional"
        defaultValue={member.physicalAddress ?? ""}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="region" label="Region" hint="Optional" defaultValue={member.region ?? ""} />
        <Input name="district" label="District" hint="Optional" defaultValue={member.district ?? ""} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          name="emergencyContactName"
          label="Emergency contact name"
          hint="Optional"
          defaultValue={member.emergencyContactName ?? ""}
        />
        <Input
          name="emergencyContactPhone"
          label="Emergency contact phone"
          hint="Optional"
          defaultValue={member.emergencyContactPhone ?? ""}
        />
      </div>
    </>
  );
}

/**
 * Self-service edit form — every field here corresponds 1:1 to
 * MemberContactInfoInput (packages/services/src/members/types.ts), which is
 * itself the same allowlist the DB trigger enforces (0023). A member's own
 * HR-restricted fields (national ID, DOB, membership status, department,
 * family, …) are simply never rendered as inputs here — there is no hidden
 * field a user could tamper with to reach them.
 */
export function MemberContactForm({
  action,
  member,
}: {
  action: (prevState: MemberFormState, formData: FormData) => Promise<MemberFormState>;
  member: MemberDetailLike;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ContactInfoFields member={member} />
      <FormError error={state.error} />
      <div>
        <SubmitButton label="Save changes" pendingLabel="Saving…" />
      </div>
    </form>
  );
}

interface MemberRecordLike extends MemberDetailLike {
  middleName: string | null;
  dateOfBirth: string | null;
  nationalIdNumber: string | null;
  membershipStatus: string;
  joinedAt: string | null;
  exitedAt: string | null;
  exitReason: string | null;
}

/**
 * HR full-record edit form. Deliberately has NO department/family fields —
 * those are reassigned only through AssignDepartmentForm/AssignFamilyForm
 * below, which call the dedicated assignDepartment()/assignFamily()
 * service functions so the member_departments/member_families history log
 * can never silently drift from members.primary_department_id/family_id.
 */
export function MemberRecordForm({
  action,
  member,
}: {
  action: (prevState: MemberFormState, formData: FormData) => Promise<MemberFormState>;
  member: MemberRecordLike;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ContactInfoFields member={member} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="middleName" label="Middle name" hint="Optional" defaultValue={member.middleName ?? ""} />
        <Input
          name="dateOfBirth"
          type="date"
          label="Date of birth"
          hint="Optional"
          defaultValue={member.dateOfBirth ?? ""}
        />
      </div>
      <Input
        name="nationalIdNumber"
        label="National ID number"
        hint="Optional"
        defaultValue={member.nationalIdNumber ?? ""}
      />
      <Select
        name="membershipStatus"
        label="Membership status"
        options={MEMBERSHIP_STATUS_OPTIONS}
        defaultValue={member.membershipStatus}
        required
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="joinedAt" type="date" label="Joined at" hint="Optional" defaultValue={member.joinedAt ?? ""} />
        <Input name="exitedAt" type="date" label="Exited at" hint="Optional" defaultValue={member.exitedAt ?? ""} />
      </div>
      <Textarea name="exitReason" label="Exit reason" hint="Optional" defaultValue={member.exitReason ?? ""} />
      <FormError error={state.error} />
      <div>
        <SubmitButton label="Save changes" pendingLabel="Saving…" />
      </div>
    </form>
  );
}

export function AssignDepartmentForm({
  action,
  departmentOptions,
}: {
  action: (prevState: AssignmentFormState, formData: FormData) => Promise<AssignmentFormState>;
  departmentOptions: SelectOption[];
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select name="departmentId" label="Department" placeholder="Select…" options={departmentOptions} required />
      <Select
        name="assignmentType"
        label="Assignment type"
        options={[
          { value: "primary", label: "Primary" },
          { value: "secondary", label: "Secondary" },
        ]}
        defaultValue="primary"
        required
      />
      <Textarea name="notes" label="Notes" hint="Optional — recorded in the assignment history" />
      <FormError error={state.error} />
      <div>
        <SubmitButton label="Assign" pendingLabel="Assigning…" />
      </div>
    </form>
  );
}

const BLANK_MEMBER: MemberDetailLike = {
  firstName: "",
  lastName: "",
  preferredName: null,
  gender: null,
  nationality: null,
  email: null,
  phone: null,
  whatsappNumber: null,
  physicalAddress: null,
  region: null,
  district: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
};

/**
 * HR "add a member manually" form. membershipStatus is never an input here
 * — createMember() always starts a new member in `probation` (see that
 * function's doc comment) — and department/family are optional at
 * creation time only because a brand-new member may not be placed yet;
 * once set they still flow through the same member_departments/
 * member_families history writes as any later reassignment.
 */
export function MemberCreateForm({
  action,
  departmentOptions,
  familyOptions,
}: {
  action: (prevState: MemberFormState, formData: FormData) => Promise<MemberFormState>;
  departmentOptions: SelectOption[];
  familyOptions: SelectOption[];
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ContactInfoFields member={BLANK_MEMBER} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input name="middleName" label="Middle name" hint="Optional" />
        <Input name="dateOfBirth" type="date" label="Date of birth" hint="Optional" />
      </div>
      <Input name="nationalIdNumber" label="National ID number" hint="Optional" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          name="primaryDepartmentId"
          label="Primary department"
          hint="Optional — can be set later"
          placeholder="Select…"
          options={departmentOptions}
        />
        <Select
          name="familyId"
          label="Family"
          hint="Optional — can be set later"
          placeholder="Select…"
          options={familyOptions}
        />
      </div>
      <Input name="joinedAt" type="date" label="Joined at" hint="Optional" />
      <FormError error={state.error} />
      <div>
        <SubmitButton label="Add member" pendingLabel="Adding…" />
      </div>
    </form>
  );
}

export function AssignFamilyForm({
  action,
  familyOptions,
}: {
  action: (prevState: AssignmentFormState, formData: FormData) => Promise<AssignmentFormState>;
  familyOptions: SelectOption[];
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Select name="familyId" label="Family" placeholder="Select…" options={familyOptions} required />
      <Textarea name="notes" label="Notes" hint="Optional — recorded in the assignment history" />
      <FormError error={state.error} />
      <div>
        <SubmitButton label="Assign" pendingLabel="Assigning…" />
      </div>
    </form>
  );
}
