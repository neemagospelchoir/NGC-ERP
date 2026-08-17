import type { Metadata } from "next";
import { auth, departments, reports } from "@ngc/services";
import { Card, EmptyState, PageHeader, Select } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { MEMBERSHIP_STATUS_OPTIONS } from "../members/status";
import { INVITATION_STATUS_OPTIONS } from "../invitations/status";
import { CONTRIBUTION_STATUS_OPTIONS } from "../contributions/status";
import { EXPENSE_STATUS_OPTIONS } from "../expenses/status";
import { VENDOR_STATUS_OPTIONS } from "../vendors/status";
import { ASSET_AVAILABILITY_STATUS_OPTIONS } from "../assets/status";
import { EVENT_STATUS_OPTIONS } from "../events/status";
import { CASE_STATUS_OPTIONS } from "../discipline/status";
import { LEAVE_STATUS_OPTIONS } from "../leave/status";
import { WORKFLOW_INSTANCE_STATUS_OPTIONS } from "../approvals/status";
import { parseReportSearchParams, reportQueryString, type ReportSearchParams } from "./filters";
import { ReportResultTable } from "./report-result-table";

export const metadata: Metadata = { title: "Reports — NGC ERP" };

const DISCIPLINE_READ_PERMISSION = "discipline.cases.read";
const DISCIPLINE_MANAGE_PERMISSION = "discipline.cases.manage";

const PERIOD_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom range" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: MONTH_NAMES[i] }));

const QUARTER_OPTIONS = [
  { value: "1", label: "Q1 (Jan–Mar)" },
  { value: "2", label: "Q2 (Apr–Jun)" },
  { value: "3", label: "Q3 (Jul–Sep)" },
  { value: "4", label: "Q4 (Oct–Dec)" },
];

type StatusFilterKind =
  | "membership"
  | "invitation"
  | "contribution"
  | "expense"
  | "vendor"
  | "asset"
  | "event"
  | "case"
  | "leave"
  | "workflow"
  | "none";

/** Which of the two generic ReportFilters (departmentId/status) a given report actually uses — each definition's own doc comment (packages/services/src/reports/definitions/*.ts) states what, if anything, it does with `filters.status`; this matrix mirrors that 1:1 so the form only shows the controls a report can act on rather than a one-size-fits-all filter bar. None of the 11 reports added in Phase 13.2 read `filters.departmentId` (only Members/Attendance do), so all of them are `department: false` here. */
const REPORT_FILTER_SUPPORT: Record<reports.ReportKey, { department: boolean; status: StatusFilterKind }> = {
  members: { department: true, status: "membership" },
  attendance: { department: true, status: "none" },
  invitations: { department: false, status: "invitation" },
  contributions: { department: false, status: "contribution" },
  expenses: { department: false, status: "expense" },
  vendors: { department: false, status: "vendor" },
  assets: { department: false, status: "asset" },
  events: { department: false, status: "event" },
  logistics: { department: false, status: "none" },
  technical: { department: false, status: "none" },
  uniforms: { department: false, status: "none" },
  discipline: { department: false, status: "case" },
  hr: { department: false, status: "leave" },
  management: { department: false, status: "workflow" },
};

const STATUS_OPTIONS_BY_KIND: Record<Exclude<StatusFilterKind, "none">, { value: string; label: string }[]> = {
  membership: MEMBERSHIP_STATUS_OPTIONS,
  invitation: INVITATION_STATUS_OPTIONS,
  contribution: CONTRIBUTION_STATUS_OPTIONS,
  expense: EXPENSE_STATUS_OPTIONS,
  vendor: VENDOR_STATUS_OPTIONS,
  asset: ASSET_AVAILABILITY_STATUS_OPTIONS,
  event: EVENT_STATUS_OPTIONS,
  case: CASE_STATUS_OPTIONS,
  leave: LEAVE_STATUS_OPTIONS,
  workflow: WORKFLOW_INSTANCE_STATUS_OPTIONS,
};

/**
 * The Reporting UI (Phase 13.1's MVP three, extended with the remaining
 * eleven PRD §11 subjects in Phase 13.2). No permission gate on the page
 * itself for 13 of the 14 reports, by design (see docs/PHASE_13_1.md §4):
 * every other report definition composes pre-existing, already-
 * independently-RLS-scoped service functions, so a caller can never export
 * more than the corresponding live module page already shows them — the
 * same "RLS is the real boundary, the nav is a convenience" pattern used
 * throughout this app (see (erp)/layout.tsx). The Discipline Report is the
 * one exception (see docs/PHASE_13_2.md §2): it is genuinely confidential
 * (spec S33), so this page hides it from the picker and refuses to run it
 * for anyone lacking `discipline.cases.read`/`.manage`, mirroring
 * `discipline/page.tsx`'s own in-page guard rather than relying on RLS
 * alone to make the resulting empty result self-explanatory.
 *
 * Filters are plain GET query params, same as every other list page in
 * this app (see members/page.tsx's own doc comment) — a report run is a
 * bookmarkable/shareable URL, and the export links below reuse the exact
 * same params so a download always matches what's on screen.
 */
export default async function ReportsPage(props: { searchParams: Promise<ReportSearchParams> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const [allDefinitions, departmentOptions, currentUser] = await Promise.all([
    Promise.resolve(reports.listReportDefinitions()),
    departments.listDepartments(supabase),
    auth.getCurrentUserWithRoles(supabase),
  ]);

  const canReadDiscipline = Boolean(
    currentUser?.permissionCodes.includes(DISCIPLINE_READ_PERMISSION) ||
      currentUser?.permissionCodes.includes(DISCIPLINE_MANAGE_PERMISSION)
  );
  const definitions = canReadDiscipline ? allDefinitions : allDefinitions.filter((d) => d.key !== "discipline");

  const parsed = parseReportSearchParams(searchParams);
  const selectedReportKey = "reportKey" in parsed ? parsed.reportKey : undefined;
  const filterSupport = selectedReportKey ? REPORT_FILTER_SUPPORT[selectedReportKey] : undefined;

  let result: reports.ReportResult | null = null;
  let runError: string | null = null;
  if ("reportKey" in parsed) {
    if (parsed.reportKey === "discipline" && !canReadDiscipline) {
      runError = "This is a confidential module. You don't have permission to view disciplinary cases.";
    } else {
      try {
        result = await reports.runReport(supabase, parsed.reportKey, parsed.filters);
      } catch (err) {
        runError = err instanceof reports.ServiceError ? err.message : "Failed to run this report.";
      }
    }
  }

  const periodType = searchParams.period ?? "monthly";
  const exportBase = `/reports/export?${reportQueryString(searchParams)}`;

  return (
    <>
      <PageHeader title="Reports" breadcrumb={["NGC ERP"]} />

      <Card className="mb-6">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <Select
            label="Report"
            name="report"
            defaultValue={searchParams.report ?? ""}
            placeholder="Choose a report…"
            options={definitions.map((d) => ({ value: d.key, label: d.title }))}
          />
          <Select label="Period" name="period" defaultValue={periodType} options={PERIOD_OPTIONS} />

          {periodType === "custom" ? (
            <>
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
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-sm text-ink-secondary">
                Year
                <input
                  type="number"
                  name="year"
                  defaultValue={searchParams.year ?? String(new Date().getFullYear())}
                  className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
                />
              </label>
              {periodType === "monthly" && (
                <Select label="Month" name="month" defaultValue={searchParams.month ?? "1"} options={MONTH_OPTIONS} />
              )}
              {periodType === "quarterly" && (
                <Select label="Quarter" name="quarter" defaultValue={searchParams.quarter ?? "1"} options={QUARTER_OPTIONS} />
              )}
            </>
          )}

          {(!selectedReportKey || filterSupport?.department) && (
            <Select
              label="Department"
              name="department"
              defaultValue={searchParams.department ?? ""}
              placeholder="All departments"
              options={departmentOptions.map((d) => ({ value: d.id, label: d.name }))}
            />
          )}
          {filterSupport && filterSupport.status !== "none" && (
            <Select
              label="Status"
              name="status"
              defaultValue={searchParams.status ?? ""}
              placeholder="All statuses"
              options={STATUS_OPTIONS_BY_KIND[filterSupport.status]}
            />
          )}

          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
            >
              Run report
            </button>
          </div>
        </form>
      </Card>

      {runError && (
        <Card className="mb-6">
          <EmptyState title="Couldn't run this report" description={runError} />
        </Card>
      )}

      {result && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-primary">{result.title}</h2>
              <p className="text-sm text-ink-secondary">
                {result.period.from} to {result.period.to} · {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex gap-2">
              <a href={`${exportBase}&format=csv`} className="inline-flex h-9 items-center rounded-md border border-hairline px-3 text-sm font-medium text-ink-primary hover:bg-surface-plane">
                Download CSV
              </a>
              <a href={`${exportBase}&format=xlsx`} className="inline-flex h-9 items-center rounded-md border border-hairline px-3 text-sm font-medium text-ink-primary hover:bg-surface-plane">
                Download Excel
              </a>
              <a href={`${exportBase}&format=pdf`} className="inline-flex h-9 items-center rounded-md border border-hairline px-3 text-sm font-medium text-ink-primary hover:bg-surface-plane">
                Download PDF
              </a>
            </div>
          </div>

          <ReportResultTable result={result} />
        </>
      )}

      {!result && !runError && (
        <Card>
          <EmptyState title="Choose a report" description="Pick a report and a period above, then run it to see results and export options." />
        </Card>
      )}
    </>
  );
}
