import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, media } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { deleteMediaLinkAction, updateMediaLinkAction } from "../actions";
import { MediaLinkForm } from "../media-link-form";
import { linkTypeLabel } from "../status";

export const metadata: Metadata = { title: "Media link — NGC ERP" };

const MANAGE_PERMISSION = "media.links.manage";

/**
 * Gated on `media.links.manage` (not ownership) the same shape as
 * Announcements' detail page — `media_links_write_media` RLS grants full
 * CRUD to any holder, not just the row's own creator, so there is no
 * legitimate "read but not manage" visitor to this specific page: a
 * non-manager who can read the row at all already saw everything they
 * need on the list page's own link/title, with no separate detail view to
 * offer them.
 */
export default async function MediaLinkDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  if (!canManage) {
    return (
      <>
        <PageHeader title="Media link" breadcrumb={["NGC ERP", "Media"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to manage media links.</p>
        </Card>
      </>
    );
  }

  const link = await media.getMediaLink(supabase, params.id);
  if (!link) notFound();

  const boundUpdate = updateMediaLinkAction.bind(null, link.id);
  const deleteAction = async () => {
    "use server";
    await deleteMediaLinkAction(link.id);
  };

  return (
    <>
      <PageHeader
        title={link.title ?? link.url}
        breadcrumb={["NGC ERP", "Media"]}
        action={link.isPublished ? <StatusPill tone="good" label="Published" /> : <StatusPill tone="neutral" label="Draft / shared" />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <MediaLinkForm action={boundUpdate} initial={link} submitLabel="Save changes" pendingLabel="Saving…" />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Type</CardTitle>
          </CardHeader>
          <p className="mb-4 text-sm text-ink-primary">{linkTypeLabel(link.linkType)}</p>
          <form action={deleteAction}>
            <Button type="submit" variant="destructive" size="sm">
              Delete media link
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
