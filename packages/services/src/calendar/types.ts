export type CalendarItemType = "event" | "attendance_session" | "contribution_deadline";

/**
 * A single unified row on the Calendar. Deliberately thin — just enough to
 * render an agenda list and link through to the real record's own existing
 * page (`/events/:id`, `/attendance/:id`, `/contributions/:id`).
 * This module never duplicates or re-derives the source record's own
 * fields beyond what a list view needs; the linked page is the source of
 * truth for detail.
 */
export interface CalendarItem {
  /** Globally unique across types, e.g. `event:<uuid>`. */
  id: string;
  type: CalendarItemType;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  title: string;
  /** A short type-specific descriptor — event category, session type, or campaign status. */
  subtitle: string;
  /** Relative path to the source record's own existing page. */
  href: string;
}

export interface ListCalendarItemsOptions {
  /** Inclusive ISO `YYYY-MM-DD` range. Both required — the Calendar UI always requests one visible month at a time rather than an unbounded read. */
  from: string;
  to: string;
  /** Restrict to one or more types; omit for all three. */
  types?: CalendarItemType[];
}
