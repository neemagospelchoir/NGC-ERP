import type { Metadata } from "next";
import Link from "next/link";
import { attendance, auth, departments } from "@ngc/services";
import { Button, Card, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { SessionsTable } from "./sessions-table";

export const metadata: Metadata = { title: "Attendance — NGC ERP" };

const MANAGE_PERMISSION = "attendance.records.manage";

/**
 * `attendance_sessions_select_scoped` RLS (0006) already limits results to
 * whole-choir sessions, sessions in the caller's own department scope, or
 * anyone holding `attendance.records.read_all` — same "trust Postgres"
 * pattern as every other list page. "New session" is shown to anyone
 * holding `attendance.records.manage` OR any department-scoped role (a
 * Department Leader) — RLS is still the actual gate on the write itself if
 * they pick a department outside their own scope.
 */
export default async function AttendancePage(
  props: {
    searchParams: Promise<{ departmentId?: string; from?: string; to?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const [rows, currentUser, departmentRows] = await Promise.all([
    attendance.listSessions(supabase, {
      departmentId: searchParams.departmentId || undefined,
      from: searchParams.from || undefined,
      to: searchParams.to || undefined,
    }),
    auth.getCurrentUserWithRoles(supabase),
    departments.listDepartments(supabase),
  ]);

  const canCreate = Boolean(
    currentUser?.permissionCodes.includes(MANAGE_PERMISSION) || currentUser?.roles.some((r) => r.scopeType === "department")
  );

  return (
    <>
      <PageHeader
        title="Attendance"
        breadcrumb={["NGC ERP"]}
        action={
          canCreate ? (
            <Link href="/attendance/new">
              <Button>New session</Button>
            </Link>
          ) : undefined
        }
      />
      <Card className="mb-6">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Department
            <select
              name="departmentId"
              defaultValue={searchParams.departmentId ?? ""}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            >
              <option value="">All departments</option>
              {departmentRows.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            From
            <input
              type="date"
              name="from"
              defaultValue={searchParams.from ?? ""}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            To
            <input
              type="date"
              name="to"
              defaultValue={searchParams.to ?? ""}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            />
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
      <SessionsTable rows={rows} />
    </>
  );
}
