import type { Metadata } from "next";
import { auth, notifications } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createTemplateAction } from "../actions";
import { TemplateForm } from "../template-form";
import { TemplatesTable } from "../templates-table";

export const metadata: Metadata = { title: "Notification Templates — NGC ERP" };

const MANAGE_PERMISSION = "communications.templates.manage";

/**
 * Gated on `communications.templates.manage` — unlike Announcements/
 * Notifications, templates have no self-service reader at all (PRD §7.21's
 * template library is a Communications-staff tool, matching Vendors/Gate
 * Passes' own nav treatment), so this page shows an explicit "you don't
 * have permission" message rather than relying on RLS-returns-null (which
 * wouldn't apply anyway — `notification_templates_read_authenticated` RLS
 * (0016) lets ANY signed-in user read templates; this page's own gate is
 * what actually restricts who reaches the management UI).
 */
export default async function NotificationTemplatesPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  if (!canManage) {
    return (
      <>
        <PageHeader title="Notification Templates" breadcrumb={["NGC ERP", "Notifications"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to manage notification templates.</p>
        </Card>
      </>
    );
  }

  const templates = await notifications.listNotificationTemplates(supabase, { includeInactive: true });

  return (
    <>
      <PageHeader title="Notification Templates" breadcrumb={["NGC ERP", "Notifications"]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <TemplatesTable rows={templates} />
        <Card>
          <CardHeader>
            <CardTitle>New template</CardTitle>
          </CardHeader>
          <TemplateForm action={createTemplateAction} submitLabel="Create template" pendingLabel="Creating…" />
        </Card>
      </div>
    </>
  );
}
