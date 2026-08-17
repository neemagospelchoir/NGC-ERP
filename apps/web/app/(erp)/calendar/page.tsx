import type { Metadata } from "next";
import Link from "next/link";
import { calendar } from "@ngc/services";
import { Badge, Card, EmptyState, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { dayLabel, monthBounds, monthLabel, monthParam, parseMonthParam, shiftMonth } from "./date-utils";

type CalendarItemType = calendar.CalendarItemType;

export const metadata: Metadata = { title: "Calendar — NGC ERP" };

const ALL_TYPES: CalendarItemType[] = ["event", "attendance_session", "contribution_deadline"];

const TYPE_LABELS: Record<CalendarItemType, string> = {
  event: "Event",
  attendance_session: "Attendance",
  contribution_deadline: "Contribution deadline",
};

const TYPE_BADGE_VARIANT: Record<CalendarItemType, "brand" | "accent" | "neutral"> = {
  event: "brand",
  attendance_session: "accent",
  contribution_deadline: "neutral",
};

function parseTypesParam(typesParam: string | undefined): CalendarItemType[] {
  if (!typesParam) return ALL_TYPES;
  const requested = typesParam.split(",").filter((t): t is CalendarItemType => (ALL_TYPES as string[]).includes(t));
  return requested.length > 0 ? requested : ALL_TYPES;
}

function buildHref(year: number, month: number, types: CalendarItemType[]): string {
  const params = new URLSearchParams({ month: monthParam(year, month) });
  if (types.length !== ALL_TYPES.length) params.set("types", types.join(","));
  return `/calendar?${params.toString()}`;
}

/**
 * A read-only agenda view, not an interactive month grid — `@ngc/ui` has no
 * calendar-grid component, and PRD §7.23's "Month/Week/Day/Agenda views"
 * are served here by the one that needs no new widget: a date-grouped list
 * for the selected month, with Month/Week/Day navigation left for a future
 * phase should a real grid ever get built (see docs/PHASE_10_3.md §1).
 *
 * No permission gate beyond being signed in — `listCalendarItems` composes
 * three already-independently-scoped reads (`events.listEvents`,
 * `attendance.listSessions`, `contributions.listCampaigns`), so a plain
 * member sees exactly what their own RLS session already permits on the
 * Events/Attendance/Contributions pages, merged into one list.
 */
export default async function CalendarPage(props: { searchParams: Promise<{ month?: string; types?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const todayIso = new Date().toISOString().slice(0, 10);
  const { year, month } = parseMonthParam(searchParams.month, todayIso);
  const types = parseTypesParam(searchParams.types);
  const { from, to } = monthBounds(year, month);

  const items = await calendar.listCalendarItems(supabase, { from, to, types });

  const itemsByDate = new Map<string, typeof items>();
  for (const item of items) {
    const existing = itemsByDate.get(item.date);
    if (existing) existing.push(item);
    else itemsByDate.set(item.date, [item]);
  }
  const sortedDates = [...itemsByDate.keys()].sort();

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <>
      <PageHeader title="Calendar" breadcrumb={["NGC ERP"]} />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={buildHref(prev.year, prev.month, types)} className="text-sm font-medium text-brand-700 hover:underline">
              ← Previous
            </Link>
            <h2 className="text-lg font-semibold text-ink-primary">{monthLabel(year, month)}</h2>
            <Link href={buildHref(next.year, next.month, types)} className="text-sm font-medium text-brand-700 hover:underline">
              Next →
            </Link>
          </div>
          <form method="get" className="flex flex-wrap items-center gap-4">
            <input type="hidden" name="month" value={monthParam(year, month)} />
            {ALL_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm text-ink-secondary">
                <input type="checkbox" name="types" value={t} defaultChecked={types.includes(t)} className="h-4 w-4 rounded border-hairline" />
                {TYPE_LABELS[t]}
              </label>
            ))}
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md border border-brand-300 bg-transparent px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Apply
            </button>
          </form>
        </div>
      </Card>

      {sortedDates.length === 0 ? (
        <EmptyState title="Nothing on the calendar" description="No events, attendance sessions, or contribution deadlines fall in this month for the filters selected." />
      ) : (
        <div className="flex flex-col gap-6">
          {sortedDates.map((date) => (
            <Card key={date}>
              <h3 className="mb-3 text-sm font-semibold text-ink-primary">
                {dayLabel(date)}
                {date === todayIso ? (
                  <span className="ml-2 text-xs font-normal text-brand-700">Today</span>
                ) : null}
              </h3>
              <ul className="flex flex-col gap-2">
                {(itemsByDate.get(date) ?? []).map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-hairline px-3 py-2">
                    <Badge variant={TYPE_BADGE_VARIANT[item.type]}>{TYPE_LABELS[item.type]}</Badge>
                    <Link href={item.href} className="text-sm font-medium text-ink-primary hover:underline">
                      {item.title}
                    </Link>
                    <span className="text-xs text-ink-secondary">{item.subtitle}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
