"use server";

import { revalidatePath } from "next/cache";
import { auth, playlists } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export interface PlaylistFormState {
  error?: string;
}

function readOptionalString(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createPlaylistAction(_prevState: PlaylistFormState, formData: FormData): Promise<PlaylistFormState> {
  const supabase = await createClient();
  try {
    const currentUser = await auth.getCurrentUserWithRoles(supabase);
    await playlists.createPlaylist(supabase, {
      eventId: String(formData.get("eventId") ?? ""),
      title: readOptionalString(formData, "title") ?? undefined,
      createdBy: currentUser?.id ?? null,
    });
  } catch (err) {
    if (err instanceof playlists.ServiceError) return { error: err.message };
    return { error: "Could not create the playlist." };
  }
  revalidatePath("/playlists");
  return {};
}

export async function updatePlaylistAction(
  playlistId: string,
  _prevState: PlaylistFormState,
  formData: FormData
): Promise<PlaylistFormState> {
  const supabase = await createClient();
  try {
    const sharedWithRoles = String(formData.get("sharedWithRoles") ?? "")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    await playlists.updatePlaylist(supabase, playlistId, {
      title: String(formData.get("title") ?? ""),
      sharedWithRoles,
    });
  } catch (err) {
    if (err instanceof playlists.ServiceError) return { error: err.message };
    return { error: "Could not update the playlist." };
  }
  revalidatePath("/playlists");
  revalidatePath(`/playlists/${playlistId}`);
  return {};
}

export async function addPlaylistItemAction(
  playlistId: string,
  _prevState: PlaylistFormState,
  formData: FormData
): Promise<PlaylistFormState> {
  const supabase = await createClient();
  try {
    const backingVocalMemberIds = String(formData.get("backingVocalMemberIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    await playlists.addPlaylistItem(supabase, playlistId, {
      sequenceNumber: Number(formData.get("sequenceNumber") ?? 0),
      songTitle: String(formData.get("songTitle") ?? ""),
      musicalKey: readOptionalString(formData, "musicalKey"),
      durationSeconds: formData.get("durationSeconds") ? Number(formData.get("durationSeconds")) : null,
      leadVocalMemberId: readOptionalString(formData, "leadVocalMemberId"),
      backingVocalMemberIds,
      instrument: readOptionalString(formData, "instrument"),
      technicalNotes: readOptionalString(formData, "technicalNotes"),
    });
  } catch (err) {
    if (err instanceof playlists.ServiceError) return { error: err.message };
    return { error: "Could not add the song to the playlist." };
  }
  revalidatePath("/playlists");
  revalidatePath(`/playlists/${playlistId}`);
  return {};
}

export async function updatePlaylistItemAction(
  playlistId: string,
  itemId: string,
  _prevState: PlaylistFormState,
  formData: FormData
): Promise<PlaylistFormState> {
  const supabase = await createClient();
  try {
    const backingVocalMemberIds = String(formData.get("backingVocalMemberIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    await playlists.updatePlaylistItem(supabase, itemId, {
      sequenceNumber: Number(formData.get("sequenceNumber") ?? 0),
      songTitle: String(formData.get("songTitle") ?? ""),
      musicalKey: readOptionalString(formData, "musicalKey"),
      durationSeconds: formData.get("durationSeconds") ? Number(formData.get("durationSeconds")) : null,
      leadVocalMemberId: readOptionalString(formData, "leadVocalMemberId"),
      backingVocalMemberIds,
      instrument: readOptionalString(formData, "instrument"),
      technicalNotes: readOptionalString(formData, "technicalNotes"),
    });
  } catch (err) {
    if (err instanceof playlists.ServiceError) return { error: err.message };
    return { error: "Could not update the song." };
  }
  revalidatePath("/playlists");
  revalidatePath(`/playlists/${playlistId}`);
  return {};
}

export async function removePlaylistItemAction(playlistId: string, itemId: string): Promise<void> {
  const supabase = await createClient();
  await playlists.removePlaylistItem(supabase, itemId);
  revalidatePath("/playlists");
  revalidatePath(`/playlists/${playlistId}`);
}
