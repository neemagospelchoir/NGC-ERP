import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listCases } from "../../discipline/list";
import type { CaseStatus } from "../../discipline/types";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Discipline Report" (PRD §11) — the one report in this phase that is
 * genuinely confidential, not merely nav-gated-for-convenience the way
 * Vendors/Assets/Invitations are (see docs/PHASE_13_2.md §2 for the full
 * reasoning). `disciplinary_cases_select_discipline_only` RLS (0007)
 * restricts every row to `discipline.cases.read`/`.manage` holders — not
 * even the member a case concerns can see it, per spec S33 — so a
 * non-privileged caller running this report gets an empty result by
 * construction, same as browsing `/discipline` directly. The reports web
 * UI additionally hides this report from the picker and refuses to run it
 * for anyone lacking that permission (an explicit, belt-and-suspenders
 * check, mirroring `discipline/page.tsx`'s own in-page guard) rather than
 * relying on RLS alone to make the empty result self-explanatory.
 */
export async function runDisciplineReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const cases = await listCases(client, {
    createdFrom: from,
    createdTo: to,
    status: filters.status as CaseStatus | undefined,
  });

  return {
    reportKey: "discipline",
    title: "Discipline Report",
    period: { from, to },
    columns: [
      { key: "caseNumber", label: "Case #" },
      { key: "memberName", label: "Member" },
      { key: "category", label: "Category" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Opened" },
    ],
    rows: cases.map((c) => ({
      caseNumber: c.caseNumber,
      memberName: c.memberName,
      category: c.category,
      status: c.status,
      createdAt: c.createdAt.slice(0, 10),
    })),
  };
}
