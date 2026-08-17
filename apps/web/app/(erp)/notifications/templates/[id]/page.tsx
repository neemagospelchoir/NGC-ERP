import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, notifications } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { updateTemplateAction } from "../../actions";
import { TemplateForm } from "../../template-form";

export const metadata: Metadata = { title: "Notification Template — NGC ERP" };

const MANAGE_PERMISSION = "communications.templates.manage";

export default async function NotificationTemplateDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  if (!canManage) {
    return (
      <>
        <PageHeader title="Notification Template" breadcrumb={["NGC ERP", "Notifications", "Templates"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to manage notification templates.</p>
        </Card>
      </>
    );
  }

  const template = await notifications.getNotificationTemplate(supabase, params.id);
  if (!template) notFound();

  const boundUpdate = updateTemplateAction.bind(null, template.id);

  return (
    <>
      <PageHeader title={template.name} breadcrumb={["NGC ERP", "Notifications", "Templates"]} />
      <Card>
        <CardHeader>
          <CardTitle>Edit</CardTitle>
        </CardHeader>
        <TemplateForm action={boundUpdate} initial={template} submitLabel="Save changes" pendingLabel="Saving…" showActiveToggle />
      </Card>
    </>
  );
}
