import type { Metadata } from "next";
import { auth, media } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createMediaLinkAction } from "./actions";
import { MediaLinkForm } from "./media-link-form";
import { MediaLinksTable } from "./media-links-table";

export const metadata: Metadata = { title: "Media — NGC ERP" };

const MANAGE_PERMISSION = "media.links.manage";

/**
 * Always visible, the same "everyone has a real reason to be here" shape
 * as Announcements/Calendar — `media_links_select_scoped` RLS (0016,
 * widened by 0035) lets any signed-in user read every published item, plus
 * anyone specifically named via `shared_with_roles`/
 * `shared_with_department_ids`/`shared_with_member_ids` see an unpublished
 * one too (see 0035 for why the original policy made that structurally
 * impossible). Creating a link is shown only to `media.links.manage`
 * holders (Media Department, Super Admin per the seed).
 */
export default async function MediaPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const rows = await media.listMediaLinks(supabase);

  return (
    <>
      <PageHeader title="Media" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <MediaLinksTable rows={rows} canManage={canManage} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>New media link</CardTitle>
            </CardHeader>
            <MediaLinkForm action={createMediaLinkAction} submitLabel="Create media link" pendingLabel="Creating…" />
          </Card>
        )}
      </div>
    </>
  );
}
