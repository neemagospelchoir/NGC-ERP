import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { runAssetsReport } from "./definitions/assets";
import { runAttendanceReport } from "./definitions/attendance";
import { runContributionsReport } from "./definitions/contributions";
import { runDisciplineReport } from "./definitions/discipline";
import { runEventsReport } from "./definitions/events";
import { runExpensesReport } from "./definitions/expenses";
import { runHrReport } from "./definitions/hr";
import { runInvitationsReport } from "./definitions/invitations";
import { runLogisticsReport } from "./definitions/logistics";
import { runManagementReport } from "./definitions/management";
import { runMembersReport } from "./definitions/members";
import { runTechnicalReport } from "./definitions/technical";
import { runUniformsReport } from "./definitions/uniforms";
import { runVendorsReport } from "./definitions/vendors";
import type { ReportFilters, ReportKey, ReportResult } from "./types";

/**
 * The "single `reports` service" ARCHITECTURE.md §15 describes: one
 * registry every caller (the web UI, an export route, a future report
 * scheduler) goes through by `ReportKey` rather than importing each
 * definition function directly, so adding a new report to
 * `definitions/*.ts` never requires touching more than this one file plus
 * `types.ts`'s `ReportKey` union. Phase 13.1 shipped the first three
 * (members/attendance/invitations, PRD §15's MVP tier); Phase 13.2 adds
 * the remaining eleven PRD §11 subjects.
 */
const DEFINITIONS: Record<ReportKey, { title: string; run(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> }> = {
  members: { title: "Member Report", run: runMembersReport },
  attendance: { title: "Attendance Report", run: runAttendanceReport },
  invitations: { title: "Invitation Report", run: runInvitationsReport },
  contributions: { title: "Contribution Report", run: runContributionsReport },
  expenses: { title: "Expense Report", run: runExpensesReport },
  vendors: { title: "Vendor Report", run: runVendorsReport },
  assets: { title: "Asset Report", run: runAssetsReport },
  events: { title: "Event Report", run: runEventsReport },
  logistics: { title: "Logistics Report", run: runLogisticsReport },
  technical: { title: "Technical Report", run: runTechnicalReport },
  uniforms: { title: "Uniform Report", run: runUniformsReport },
  discipline: { title: "Discipline Report", run: runDisciplineReport },
  hr: { title: "HR Report", run: runHrReport },
  management: { title: "Management Report", run: runManagementReport },
};

export function listReportDefinitions(): Array<{ key: ReportKey; title: string }> {
  return (Object.keys(DEFINITIONS) as ReportKey[]).map((key) => ({ key, title: DEFINITIONS[key].title }));
}

export async function runReport(client: SupabaseClient<Database>, reportKey: ReportKey, filters: ReportFilters): Promise<ReportResult> {
  const definition = DEFINITIONS[reportKey];
  if (!definition) {
    throw new ServiceError(`Unknown report: ${reportKey}`);
  }
  return definition.run(client, filters);
}
