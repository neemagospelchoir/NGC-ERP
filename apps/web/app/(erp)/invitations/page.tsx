import type { Metadata } from "next";
import Link from "next/link";
import { auth, invitations } from "@ngc/services";
import { Card, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { InvitationsTable } from "./invitations-table";
import { INVITATION_STATUS_OPTIONS } from "./status";

export const metadata: Metadata = { title: "Invitations — NGC ERP" };

const READ_PERMISSION = "events.invitations.read";
const MANAGE_PERMISSION = "events.invitations.manage";

/**
 * Gated on `events.invitations.read`/`.manage`, even though
 * `invitations_select_internal` RLS (0008) is deliberately broader ("any
 * signed-in user") — see docs/PHASE_7_5.md §5. This page reflects the
 * PRD's per-role Permission Matrix (§6), which names specific staff roles
 * for this module rather than "every member"; a plain Choir Member's own
 * "events I'm assigned to" view belongs to Member Eligibility (§7.11,
 * deferred) and Event Attendance (§7.26, deferred), not this review
 * pipeline.
 */
export default async function InvitationsPage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser?.permissionCodes.includes(READ_PERMISSION) || currentUser?.permissionCodes.includes(MANAGE_PERMISSION));
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Invitations" breadcrumb={["NGC ERP"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view invitations.</p>
        </Card>
      </>
    );
  }

  const rows = await invitations.listInvitations(supabase, {
    status: (searchParams.status as invitations.InvitationStatus) || undefined,
  });

  return (
    <>
      <PageHeader
        title="Invitations"
        breadcrumb={["NGC ERP"]}
        action={
          canManage ? (
            <Link href="/invite" target="_blank" className="text-sm font-medium text-brand-700 hover:underline">
              Public submission form ↗
            </Link>
          ) : undefined
        }
      />
      <Card className="mb-6">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" method="get">
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Status
            <select
              name="status"
              defaultValue={searchParams.status ?? ""}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            >
              <option value="">All statuses</option>
              {INVITATION_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md border border-brand-300 bg-transparent px-4 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Apply filters
            </button>
          </div>
        </form>
      </Card>
      <InvitationsTable rows={rows} />
    </>
  );
}
