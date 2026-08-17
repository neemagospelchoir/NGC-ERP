export type MediaLinkType = "youtube" | "facebook" | "instagram" | "tiktok" | "google_drive" | "livestream" | "press_release" | "other";

export interface MediaLink {
  id: string;
  eventId: string | null;
  linkType: MediaLinkType;
  url: string;
  title: string | null;
  /** Role codes (e.g. `pro_spokesperson`) — `media_links_select_scoped` RLS (0035) lets a caller holding any of these roles read the row before it's published. */
  sharedWithRoles: string[];
  /** `departments.id` values — matched against the caller's own `members.primary_department_id`. */
  sharedWithDepartmentIds: string[];
  /** `members.id` values (NOT `users.id`/`auth.uid()`) — matched against the caller's own member record. */
  sharedWithMemberIds: string[];
  isPublished: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMediaLinkInput {
  eventId?: string | null;
  linkType: MediaLinkType;
  url: string;
  title?: string | null;
  sharedWithRoles?: string[];
  sharedWithDepartmentIds?: string[];
  sharedWithMemberIds?: string[];
  isPublished?: boolean;
  /**
   * Resolved server-side from the signed-in caller's own session
   * (`auth.getCurrentUserWithRoles(supabase).id`), never taken from a
   * client-supplied form field — the same "authorship is derived, not
   * trusted" shape as `announcements.createAnnouncement`'s `authorId`.
   */
  createdBy: string;
}

export type UpdateMediaLinkInput = Partial<Omit<CreateMediaLinkInput, "createdBy">>;

export interface ListMediaLinksOptions {
  eventId?: string;
}
