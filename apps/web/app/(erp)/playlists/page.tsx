import type { Metadata } from "next";
import { auth, playlists } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createPlaylistAction } from "./actions";
import { CreatePlaylistForm } from "./playlist-form";
import { PlaylistsTable } from "./playlists-table";

export const metadata: Metadata = { title: "Playlists — NGC ERP" };

const MANAGE_PERMISSION = "technical.playlists.manage";

/**
 * Always visible, like Technical Riders and Uniforms — `playlists_select_
 * scoped` RLS (0009) already narrows what a caller without
 * `technical.playlists.manage` sees down to playlists for events they
 * actually participate in, the same "everyone has a legitimate self-service
 * reason to be here, scoped to their own" shape as Uniforms' "my issued
 * items" (docs/PHASE_8_2.md), not a gated management tool like Vendors/
 * Assets/Gate Passes. Only creating/editing/managing items is gated on
 * `technical.playlists.manage`.
 *
 * A manager sees every playlist (`listPlaylists`); anyone else sees only
 * playlists for events they participate in, via the explicit
 * `listPlaylistsForParticipant` query — application-level defense-in-depth
 * on top of `playlists_select_scoped` RLS, not a replacement for it (see
 * that function's own doc comment).
 */
export default async function PlaylistsPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const rows = canManage
    ? await playlists.listPlaylists(supabase)
    : currentUser?.member
      ? await playlists.listPlaylistsForParticipant(supabase, currentUser.member.id)
      : [];

  return (
    <>
      <PageHeader title="Playlists" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <PlaylistsTable rows={rows} canManage={canManage} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Create a playlist</CardTitle>
            </CardHeader>
            <CreatePlaylistForm action={createPlaylistAction} />
          </Card>
        )}
      </div>
    </>
  );
}
