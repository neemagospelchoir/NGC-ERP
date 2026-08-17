import { NextResponse, type NextRequest } from "next/server";
import { auth, reports } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";
import { parseReportSearchParams } from "../filters";
import { renderXlsx } from "../render-xlsx";
import { renderPdf } from "../render-pdf";

export const dynamic = "force-dynamic";

const DISCIPLINE_READ_PERMISSION = "discipline.cases.read";
const DISCIPLINE_MANAGE_PERMISSION = "discipline.cases.manage";

// A Map, not a plain object literal — `format` is attacker-controlled
// (a raw query-string value), and a plain `{}` lookup like
// `CONTENT_TYPES["constructor"]` resolves to `Object.prototype`'s own
// `constructor` property (truthy) rather than `undefined`, which would
// silently defeat the whitelist check below and fall through to the PDF
// branch with a bogus Content-Type. A Map has no such inherited keys.
const CONTENT_TYPES = new Map<string, string>([
  ["csv", "text/csv; charset=utf-8"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["pdf", "application/pdf"],
]);

/**
 * Streams a report as a file download. Deliberately thin: it does NOT
 * decide what data a caller may see — `reports.runReport` (packages/
 * services) composes the same RLS-scoped listMembers/listSessions/
 * listInvitations etc. calls the on-screen /reports page uses, so the very
 * same Postgres RLS policies that already gate the live UI gate this
 * export too (ARCHITECTURE.md §15: "an export can never contain data the
 * requesting user could not otherwise see on-screen"). This route adds
 * exactly one thing on top of that: picking a rendering format.
 *
 * Layer-3 auth check (see (erp)/layout.tsx's own doc comment on why every
 * route under this group re-checks rather than trusting middleware alone)
 * is required here specifically because a Route Handler is NOT a child of
 * the (erp) layout — Next.js layouts only wrap page renders, not Route
 * Handlers under the same segment — so without this check an
 * unauthenticated request would reach `runReport` with an anonymous
 * Supabase client. RLS would still return an empty/near-empty result for
 * an anonymous session on every table these reports read (none of them
 * grant anon SELECT), but failing the request explicitly with 401 is
 * clearer than silently emailing back an empty CSV.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await auth.getCurrentUserWithRoles(supabase);
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  if (!CONTENT_TYPES.has(format)) {
    return NextResponse.json({ error: "Unsupported export format." }, { status: 400 });
  }

  const parsed = parseReportSearchParams({
    report: url.searchParams.get("report") ?? undefined,
    period: url.searchParams.get("period") ?? undefined,
    year: url.searchParams.get("year") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    quarter: url.searchParams.get("quarter") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    department: url.searchParams.get("department") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Belt-and-suspenders check mirroring the on-screen page: the Discipline
  // Report is the one genuinely confidential report (spec S33 — see
  // discipline.ts's own doc comment and docs/PHASE_13_2.md §2), and unlike
  // every other report, RLS returning an empty result for a non-privileged
  // caller isn't relied on to make that outcome self-explanatory in a
  // downloaded file — this route refuses the export outright instead.
  if (parsed.reportKey === "discipline") {
    const canReadDiscipline = Boolean(
      user.permissionCodes.includes(DISCIPLINE_READ_PERMISSION) || user.permissionCodes.includes(DISCIPLINE_MANAGE_PERMISSION)
    );
    if (!canReadDiscipline) {
      return NextResponse.json({ error: "You don't have permission to export this report." }, { status: 403 });
    }
  }

  let result: reports.ReportResult;
  try {
    result = await reports.runReport(supabase, parsed.reportKey, parsed.filters);
  } catch (err) {
    const message = err instanceof reports.ServiceError ? err.message : "Failed to run report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let body: Buffer | string;
  if (format === "csv") {
    body = reports.toCsv(result);
  } else if (format === "xlsx") {
    body = await renderXlsx(result);
  } else {
    body = await renderPdf(result);
  }

  // The filename is built entirely from the fixed reportKey union and the
  // resolved period bounds — never from arbitrary free-text user input —
  // so there is no header-injection or path surface here despite the
  // Content-Disposition header being string-built. This relies on
  // `parseReportSearchParams` (filters.ts) having already rejected any
  // custom `from`/`to` that isn't a strict YYYY-MM-DD string (a gap a
  // security review caught: the Invitations report's period filtering is
  // an in-memory string comparison, not a Postgres date column, so
  // nothing else downstream would have rejected a malformed value before
  // it reached this filename).
  const filename = `${parsed.reportKey}-report-${result.period.from}-to-${result.period.to}.${format}`;

  // NextResponse's BodyInit typing doesn't include Node's Buffer directly
  // (despite Buffer being a Uint8Array at runtime) — an explicit Uint8Array
  // view over the same underlying bytes satisfies it without copying.
  const responseBody = typeof body === "string" ? body : new Uint8Array(body);

  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      // Non-null: the CONTENT_TYPES.has(format) check above already
      // guarantees a matching entry exists.
      "Content-Type": CONTENT_TYPES.get(format) as string,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
