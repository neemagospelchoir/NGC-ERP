import type { Metadata } from "next";
import { probation } from "@ngc/services";
import { Card, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { ProbationTable } from "./probation-table";
import { PROBATION_STATUS_OPTIONS } from "./status";

export const metadata: Metadata = { title: "Probation — NGC ERP" };

/**
 * `probation_select_scoped` RLS (0005) already limits results to: the
 * member's own probation record, a caller holding
 * `members.applications.read`, or the probation's own
 * `responsible_leader_id` — same "trust Postgres" pattern as every other
 * list page in this codebase.
 */
export default async function ProbationPage(
  props: {
    searchParams: Promise<{ status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const rows = await probation.listProbations(supabase, {
    status: (searchParams.status as probation.ProbationStatus) || undefined,
  });

  return (
    <>
      <PageHeader title="Probation" breadcrumb={["NGC ERP"]} />
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
              {PROBATION_STATUS_OPTIONS.map((opt) => (
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
      <ProbationTable rows={rows} />
    </>
  );
}
