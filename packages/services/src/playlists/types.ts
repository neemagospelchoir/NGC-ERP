export interface Playlist {
  id: string;
  eventId: string;
  title: string;
  sharedWithRoles: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItem {
  id: string;
  playlistId: string;
  sequenceNumber: number;
  songTitle: string;
  musicalKey: string | null;
  durationSeconds: number | null;
  leadVocalMemberId: string | null;
  backingVocalMemberIds: string[];
  instrument: string | null;
  technicalNotes: string | null;
  createdAt: string;
}

export interface CreatePlaylistInput {
  eventId: string;
  title?: string;
  createdBy?: string | null;
}

export interface UpdatePlaylistInput {
  title?: string;
  /**
   * `shared_with_roles` (0009) — flagged in docs/PHASE_8_4.md §7 as stored
   * but not enforced by `playlists_select_scoped`; enforced since Phase
   * 14.1 (migration 0037), which reused media_links' own role-array-
   * membership RLS pattern (0035). A role code listed here now genuinely
   * grants that role's holders read access to this playlist.
   */
  sharedWithRoles?: string[];
}

export interface AddPlaylistItemInput {
  sequenceNumber: number;
  songTitle: string;
  musicalKey?: string | null;
  durationSeconds?: number | null;
  leadVocalMemberId?: string | null;
  backingVocalMemberIds?: string[];
  instrument?: string | null;
  technicalNotes?: string | null;
}

export interface UpdatePlaylistItemInput {
  sequenceNumber?: number;
  songTitle?: string;
  musicalKey?: string | null;
  durationSeconds?: number | null;
  leadVocalMemberId?: string | null;
  backingVocalMemberIds?: string[];
  instrument?: string | null;
  technicalNotes?: string | null;
}
