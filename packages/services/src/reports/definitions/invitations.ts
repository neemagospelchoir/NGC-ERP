import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listInvitations } from "../../invitations/list";
import type { InvitationStatus } from "../../invitations/types";
import { resolvePeriodRange } from "../period";
import type { ReportFilters, ReportResult } from "../types";

/**
 * "Invitation Report" (PRD §11; §7.8 additionally names volume/approval-
 * rate/attendance-rate/financial-value/geographic-distribution as
 * eventual invitation-reporting dimensions — this V1 cut is the "volume"
 * dimension: every invitation received in the period, with its outcome
 * and region, from which a reader can already see approval rate by eye
 * or by re-sorting an export). The richer aggregate metrics (a computed
 * approval-rate percentage, a geographic chart, a summed financial value)
 * are deliberately NOT built this phase — `financialInformation` is a
 * free-text field (0008), not a structured currency amount, so there is
 * nothing numeric to sum even if this report tried to; PRD §15 itself
 * separates "full Reporting engine" from "Management KPI dashboards" as
 * two distinct V2 features, and this report is the former, not the
 * latter. See docs/PHASE_13_1.md §1 for this scoping decision stated
 * explicitly.
 *
 * `listInvitations` has no `from`/`to` of its own (its RLS,
 * `invitations_select_internal`, already scopes to "any signed-in user" —
 * see that function's own doc comment on why that's a deliberate
 * transparency choice, not a gap), so the period is applied here against
 * `createdAt` ("received") after the fact — a small in-memory filter over
 * what is, per that same RLS design, already a modest, platform-wide-
 * readable table, not a filter this function needs Postgres to push down
 * for correctness or scale.
 */
export async function runInvitationsReport(client: SupabaseClient<Database>, filters: ReportFilters): Promise<ReportResult> {
  const { from, to } = resolvePeriodRange(filters.period);

  const invitations = await listInvitations(client, { status: filters.status as InvitationStatus | undefined });
  const inRange = invitations.filter((inv) => inv.createdAt.slice(0, 10) >= from && inv.createdAt.slice(0, 10) <= to);

  return {
    reportKey: "invitations",
    title: "Invitation Report",
    period: { from, to },
    columns: [
      { key: "invitationNumber", label: "Invitation #" },
      { key: "eventName", label: "Event" },
      { key: "organizerName", label: "Organizer" },
      { key: "proposedDate", label: "Proposed date" },
      { key: "region", label: "Region" },
      { key: "status", label: "Status" },
      { key: "receivedAt", label: "Received" },
    ],
    rows: inRange.map((inv) => ({
      invitationNumber: inv.invitationNumber,
      eventName: inv.eventName,
      organizerName: inv.organizerName,
      proposedDate: inv.proposedDate,
      region: inv.region ?? "—",
      status: inv.status,
      receivedAt: inv.createdAt.slice(0, 10),
    })),
  };
}
