import type { Metadata } from "next";
import Link from "next/link";
import { auth, discipline } from "@ngc/services";
import { Card, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { CasesTable } from "./cases-table";
import { CASE_STATUS_OPTIONS } from "./status";

export const metadata: Metadata = { title: "Discipline — NGC ERP" };

const READ_PERMISSION = "discipline.cases.read";
const MANAGE_PERMISSION = "discipline.cases.manage";

/**
 * Confidential module (spec S33/S53) — unlike Attendance & Leave's
 * always-visible nav group, this page explicitly checks for
 * discipline.cases.read/.manage itself (not just relying on the nav being
 * hidden), because a direct URL visit bypasses whatever the sidebar
 * chose to render. `disciplinary_cases_select_discipline_only` RLS (0007)
 * would return zero rows for anyone without the permission regardless —
 * this check exists so that outcome reads as "you don't have access to
 * this confidential module," not as "there happen to be no cases."
 */
export default async function DisciplinePage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(
    currentUser?.permissionCodes.includes(READ_PERMISSION) || currentUser?.permissionCodes.includes(MANAGE_PERMISSION)
  );
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Discipline" breadcrumb={["NGC ERP"]} />
        <Card>
          <p className="text-sm text-ink-secondary">
            This is a confidential module. You don&apos;t have permission to view disciplinary cases.
          </p>
        </Card>
      </>
    );
  }

  const rows = await discipline.listCases(supabase, {
    status: (searchParams.status as discipline.CaseStatus) || undefined,
  });

  return (
    <>
      <PageHeader
        title="Discipline"
        breadcrumb={["NGC ERP"]}
        action={
          canManage ? (
            <Link
              href="/discipline/new"
              className="inline-flex h-10 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              Open case
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
              {CASE_STATUS_OPTIONS.map((opt) => (
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
      <CasesTable rows={rows} />
    </>
  );
}
