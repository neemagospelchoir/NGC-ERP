import type { Metadata } from "next";
import { applications } from "@ngc/services";
import { Card, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { ApplicationsTable } from "./applications-table";
import { APPLICATION_STATUS_OPTIONS } from "./status";

export const metadata: Metadata = { title: "Applications — NGC ERP" };

/**
 * `applications_select_hr` RLS (0005) already limits results to callers
 * holding `members.applications.read` — a caller without it simply sees an
 * empty list, not an error, same "trust Postgres" pattern as every other
 * list page in this codebase.
 */
export default async function ApplicationsPage(
  props: {
    searchParams: Promise<{ status?: string; q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const rows = await applications.listApplications(supabase, {
    status: (searchParams.status as applications.ApplicationStatus) || undefined,
    search: searchParams.q || undefined,
  });

  return (
    <>
      <PageHeader title="Applications" breadcrumb={["NGC ERP"]} />
      <Card className="mb-6">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" method="get">
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Search
            <input
              type="text"
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Applicant name or application number…"
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Status
            <select
              name="status"
              defaultValue={searchParams.status ?? ""}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            >
              <option value="">All statuses</option>
              {APPLICATION_STATUS_OPTIONS.map((opt) => (
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
      <ApplicationsTable rows={rows} />
    </>
  );
}
