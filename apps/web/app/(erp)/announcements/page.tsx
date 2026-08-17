import type { Metadata } from "next";
import { announcements, auth } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createAnnouncementAction } from "./actions";
import { AnnouncementForm } from "./announcement-form";
import { AnnouncementsTable } from "./announcements-table";

export const metadata: Metadata = { title: "Announcements — NGC ERP" };

const MANAGE_PERMISSION = "communications.announcements.manage";

/**
 * Always visible, the same "everyone has a real reason to be here" shape
 * as Uniforms/Technical Riders — `announcements_select_published` RLS
 * (0016, widened by 0032) lets any signed-in user read every currently-live
 * announcement, matching PRD §6's "Choir Member: Read" exactly. The create
 * form (and, per-row, the edit/delete affordances on `[id]`) are shown only
 * to `communications.announcements.manage` holders (Super Admin, HR/Deputy
 * Secretary, PRO/Spokesperson per the seed) — PRD's own "Department Leader:
 * Create (own dept.)" entitlement has no matching scoped-write RLS today
 * (only the flat `communications.announcements.manage` permission gates
 * writes at all); this is a real, named gap, not silently worked around —
 * see docs/PHASE_10_1.md §1/§7.
 */
export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const rows = await announcements.listAnnouncements(supabase);

  return (
    <>
      <PageHeader title="Announcements" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <AnnouncementsTable rows={rows} canManage={canManage} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Post an announcement</CardTitle>
            </CardHeader>
            <AnnouncementForm action={createAnnouncementAction} submitLabel="Post announcement" pendingLabel="Posting…" />
          </Card>
        )}
      </div>
    </>
  );
}
