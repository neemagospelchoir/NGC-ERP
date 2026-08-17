import type { Metadata } from "next";
import Link from "next/link";
import { auth, notifications } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { markNotificationReadAction, sendNotificationAction } from "./actions";
import { NotificationForm } from "./notification-form";
import { NotificationsList } from "./notifications-list";

export const metadata: Metadata = { title: "Notifications — NGC ERP" };

const SEND_PERMISSION = "communications.notifications.send";
const TEMPLATES_PERMISSION = "communications.templates.manage";

/**
 * Always visible, the same "everyone has a real reason to be here" shape
 * as Contributions/Expenses — `notifications_select_own` RLS (0016) lets
 * any signed-in user read their own notifications, matching PRD §7.21's
 * in-app inbox intent. The composer is shown only to `communications.
 * notifications.send` holders (Super Admin, PRO/Spokesperson per the seed
 * — see docs/PHASE_10_2.md §2.1 for the seed-grant correction this phase
 * made for PRO/Spokesperson). Template management lives at
 * `/notifications/templates`, gated separately on `communications.
 * templates.manage`.
 */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canSend = Boolean(currentUser?.permissionCodes.includes(SEND_PERMISSION));
  const canManageTemplates = Boolean(currentUser?.permissionCodes.includes(TEMPLATES_PERMISSION));

  const [myNotifications, templates] = await Promise.all([
    currentUser ? notifications.listMyNotifications(supabase, currentUser.id) : Promise.resolve([]),
    canSend ? notifications.listNotificationTemplates(supabase) : Promise.resolve([]),
  ]);
  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }));

  return (
    <>
      <PageHeader title="Notifications" breadcrumb={["NGC ERP"]} />
      <div className={canSend ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <Card>
          <CardHeader>
            <CardTitle>My notifications</CardTitle>
          </CardHeader>
          <NotificationsList rows={myNotifications} onMarkRead={markNotificationReadAction} />
        </Card>
        {canSend && (
          <Card>
            <CardHeader>
              <CardTitle>Send a notification</CardTitle>
            </CardHeader>
            <NotificationForm action={sendNotificationAction} templateOptions={templateOptions} />
            {canManageTemplates && (
              <p className="mt-4 text-sm text-ink-secondary">
                <Link href="/notifications/templates" className="font-medium text-brand-700 hover:underline">
                  Manage templates
                </Link>
              </p>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
