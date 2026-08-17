import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, playlists } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { addPlaylistItemAction, removePlaylistItemAction, updatePlaylistAction, updatePlaylistItemAction } from "../actions";
import { EditPlaylistForm } from "../playlist-form";
import { PlaylistItemForm } from "../item-form";

export const metadata: Metadata = { title: "Playlist — NGC ERP" };

const MANAGE_PERMISSION = "technical.playlists.manage";

/**
 * `playlists_select_scoped` RLS (0009) already denies this query entirely
 * to a caller who neither holds `technical.playlists.manage` nor
 * participates in the event — `getPlaylist` simply returns `null` for them
 * and this page 404s, exactly like a nonexistent playlist would. There is
 * no separate "you don't have permission" branch to write here (unlike
 * Gate Passes, which IS gated beyond RLS) because RLS's own row-visibility
 * rule already matches the access boundary this page should show.
 */
export default async function PlaylistDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const playlist = await playlists.getPlaylist(supabase, params.id);
  if (!playlist) notFound();

  const items = await playlists.listPlaylistItems(supabase, playlist.id);
  const nextSequenceNumber = items.length > 0 ? Math.max(...items.map((i) => i.sequenceNumber)) + 1 : 1;

  const boundUpdatePlaylist = updatePlaylistAction.bind(null, playlist.id);
  const boundAddItem = addPlaylistItemAction.bind(null, playlist.id);

  return (
    <>
      <PageHeader title={playlist.title} breadcrumb={["NGC ERP", "Playlists"]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Songs</CardTitle>
            </CardHeader>
            {items.length === 0 ? (
              <p className="text-sm text-ink-secondary">No songs added yet.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {items.map((item) => {
                  // Plain zero-arg closure, not `.bind()` — matches the
                  // established `checkOutGatePassAction`/`markGatePassInTransitAction`
                  // convention (docs/PHASE_8_3.md) for a Server Action with no
                  // form fields of its own, called from inside a Server
                  // Component's render.
                  const removeItem = async () => {
                    "use server";
                    await removePlaylistItemAction(playlist.id, item.id);
                  };
                  return (
                    <li key={item.id} className="border-b border-hairline pb-4 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-ink-primary">
                        {item.sequenceNumber}. {item.songTitle}
                        {item.musicalKey && ` — ${item.musicalKey}`}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {item.instrument && `${item.instrument} · `}
                        {item.durationSeconds ? `${Math.round(item.durationSeconds / 60)} min · ` : ""}
                        {item.leadVocalMemberId ? `Lead: ${item.leadVocalMemberId}` : "No lead vocal set"}
                      </p>
                      {canManage && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-brand-700">Edit / remove</summary>
                          <div className="mt-3 flex flex-col gap-3">
                            <PlaylistItemForm
                              action={updatePlaylistItemAction.bind(null, playlist.id, item.id)}
                              item={item}
                              submitLabel="Save song"
                              pendingLabel="Saving…"
                            />
                            <form action={removeItem}>
                              <button type="submit" className="text-sm text-status-critical hover:underline">
                                Remove this song
                              </button>
                            </form>
                          </div>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canManage && (
              <div className="mt-4 border-t border-hairline pt-4">
                <h3 className="mb-3 text-sm font-medium text-ink-primary">Add a song</h3>
                <PlaylistItemForm action={boundAddItem} nextSequenceNumber={nextSequenceNumber} submitLabel="Add song" pendingLabel="Adding…" />
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <dl className="grid grid-cols-1 gap-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Event</dt>
                <dd className="text-sm text-ink-primary">
                  <Link href={`/events/${playlist.eventId}`} className="font-medium text-brand-700 hover:underline">
                    View event →
                  </Link>
                </dd>
              </div>
              {!canManage && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Shared with roles</dt>
                  <dd className="text-sm text-ink-primary">
                    {playlist.sharedWithRoles.length > 0 ? playlist.sharedWithRoles.join(", ") : "—"}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Edit playlist</CardTitle>
              </CardHeader>
              <EditPlaylistForm action={boundUpdatePlaylist} title={playlist.title} sharedWithRoles={playlist.sharedWithRoles} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
