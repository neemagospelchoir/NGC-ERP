import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { announcements, auth } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { deleteAnnouncementAction, updateAnnouncementAction } from "../actions";
import { AnnouncementForm } from "../announcement-form";

export const metadata: Metadata = { title: "Announcement — NGC ERP" };

const MANAGE_PERMISSION = "communications.announcements.manage";

/**
 * Gated on `communications.announcements.manage` — a plain member has no
 * reason to reach this edit page at all (the list page never links to it
 * for them, per `AnnouncementsTable`'s own `canManage` check), and RLS
 * itself would already return the row to them only while it's live, never
 * as an editable target. `getAnnouncement` returning `null` for a caller
 * who lacks the permission and isn't the author (0032's own author-or-manage
 * OR-clause) 404s exactly as it would for a nonexistent id, the same shape
 * as Expenses'/Leave's detail pages.
 */
export default async function AnnouncementDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  if (!canManage) {
    return (
      <>
        <PageHeader title="Announcement" breadcrumb={["NGC ERP", "Announcements"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to manage announcements.</p>
        </Card>
      </>
    );
  }

  const announcement = await announcements.getAnnouncement(supabase, params.id);
  if (!announcement) notFound();

  const boundUpdate = updateAnnouncementAction.bind(null, announcement.id);
  const remove = async () => {
    "use server";
    await deleteAnnouncementAction(announcement.id);
  };

  return (
    <>
      <PageHeader title={announcement.title} breadcrumb={["NGC ERP", "Announcements"]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Edit</CardTitle>
          </CardHeader>
          <AnnouncementForm action={boundUpdate} initial={announcement} submitLabel="Save changes" pendingLabel="Saving…" />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Delete</CardTitle>
          </CardHeader>
          <p className="mb-3 text-sm text-ink-secondary">Removes this announcement entirely. This cannot be undone.</p>
          <form action={remove}>
            <Button type="submit" variant="secondary" size="sm">
              Delete announcement
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
