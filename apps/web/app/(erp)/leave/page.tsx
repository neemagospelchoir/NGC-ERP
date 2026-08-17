import type { Metadata } from "next";
import Link from "next/link";
import { auth, leave } from "@ngc/services";
import { Button, Card, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { LeaveTable } from "./leave-table";
import { LEAVE_STATUS_OPTIONS } from "./status";

export const metadata: Metadata = { title: "Leave — NGC ERP" };

const MANAGE_PERMISSION = "attendance.leave.manage";

/**
 * `leave_requests_select_scoped` RLS (0006) already limits results to: the
 * caller's own requests, anyone holding `attendance.leave.manage`, or a
 * Department Leader viewing requests from members in their own scope.
 * This page passes `memberId` explicitly for a non-HR caller so "my
 * requests" reads naturally rather than relying only on RLS to silently
 * narrow an unscoped query (a Department Leader without
 * `attendance.leave.manage` would otherwise see their department's
 * requests too, which is correct per RLS but would be a confusing surprise
 * on a page titled "Leave" with no visible filter explaining why).
 */
export default async function LeavePage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const rows = await leave.listLeaveRequests(supabase, {
    memberId: canManage ? undefined : currentUser?.member?.id,
    status: (searchParams.status as leave.LeaveStatus) || undefined,
  });

  return (
    <>
      <PageHeader
        title="Leave"
        breadcrumb={["NGC ERP"]}
        action={
          currentUser?.member ? (
            <Link href="/leave/new">
              <Button>Request leave</Button>
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
              {LEAVE_STATUS_OPTIONS.map((opt) => (
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
      <LeaveTable rows={rows} />
    </>
  );
}
