"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { StatusPill } from "@ngc/ui";
import type { attendance } from "@ngc/services";
import type { AttendanceActionState } from "./actions";
import { attendanceStatusTone } from "./status";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function RosterRow({
  entry,
  action,
  statusOptions,
}: {
  entry: attendance.RosterEntry;
  action: (prevState: AttendanceActionState, formData: FormData) => Promise<AttendanceActionState>;
  statusOptions: attendance.AttendanceStatusOption[];
}) {
  const [state, formAction] = useActionState(action, {});
  const currentOption = statusOptions.find((s) => s.code === entry.statusCode);

  return (
    <tr className="border-b border-hairline last:border-0">
      <td className="py-2 pr-4 align-top">
        <div className="text-sm font-medium text-ink-primary">{entry.memberName}</div>
        <div className="text-xs text-ink-muted">{entry.memberNumber}</div>
      </td>
      <td className="py-2 pr-4 align-top">
        {currentOption ? (
          <StatusPill tone={attendanceStatusTone(currentOption.code, currentOption.countsAsPresent)} label={currentOption.label} />
        ) : (
          <span className="text-xs text-ink-muted">Not marked</span>
        )}
      </td>
      <td className="py-2 align-top">
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <select
            name="statusCode"
            defaultValue={entry.statusCode ?? ""}
            required
            className="h-9 rounded-sm border border-hairline bg-surface px-2 text-xs text-ink-primary"
          >
            <option value="" disabled>
              Mark…
            </option>
            {statusOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="notes"
            defaultValue={entry.notes ?? ""}
            placeholder="Notes (optional)"
            className="h-9 w-36 rounded-sm border border-hairline bg-surface px-2 text-xs text-ink-primary placeholder:text-ink-muted"
          />
          <SaveButton />
        </form>
        {state.error && <p className="mt-1 text-xs text-status-critical">{state.error}</p>}
      </td>
    </tr>
  );
}

export function RosterTable({
  entries,
  actions,
  statusOptions,
}: {
  entries: attendance.RosterEntry[];
  actions: Record<string, (prevState: AttendanceActionState, formData: FormData) => Promise<AttendanceActionState>>;
  statusOptions: attendance.AttendanceStatusOption[];
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-secondary">No members are on this session&apos;s roster.</p>;
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-hairline text-xs font-medium uppercase tracking-wide text-ink-muted">
          <th className="py-2 pr-4 font-medium">Member</th>
          <th className="py-2 pr-4 font-medium">Status</th>
          <th className="py-2 font-medium">Mark attendance</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <RosterRow key={entry.memberId} entry={entry} action={actions[entry.memberId]!} statusOptions={statusOptions} />
        ))}
      </tbody>
    </table>
  );
}
