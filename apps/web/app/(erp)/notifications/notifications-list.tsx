"use client";

import { Button, StatusPill } from "@ngc/ui";
import type { notifications } from "@ngc/services";
import { channelLabel, statusLabel, statusTone } from "./status";

/**
 * Client component so each row can render its own "Mark read" form.
 * `onMarkRead` is the `markNotificationReadAction` Server Action passed
 * down as-is from the Server Component page — `.bind(null, n.id)` per row
 * gives each form a zero-arg action, the same per-row-bound-action shape
 * `ExpensesTable`/Gate Pass's item rows already use from their own Server
 * Component pages (the binding just happens here instead, since this list
 * needs client-side interactivity for the empty-state branch below).
 */
export function NotificationsList({
  rows,
  onMarkRead,
}: {
  rows: notifications.Notification[];
  onMarkRead: (id: string) => Promise<void>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-secondary">You have no notifications yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((n) => (
        <li key={n.id} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-primary">{n.subject ?? channelLabel(n.channel)}</p>
            <StatusPill tone={statusTone(n.status)} label={statusLabel(n.status)} />
          </div>
          <p className="mt-1 text-sm text-ink-secondary">{n.body}</p>
          <p className="mt-1 text-xs text-ink-muted">{new Date(n.createdAt).toLocaleString()}</p>
          {n.status !== "read" && (
            <form action={onMarkRead.bind(null, n.id)} className="mt-2">
              <Button type="submit" variant="secondary" size="sm">
                Mark read
              </Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
