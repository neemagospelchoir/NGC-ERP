export type TargetAudience = "all" | "department" | "family" | "event_participants" | "leadership" | "specific_users";
export type AnnouncementPriority = "low" | "normal" | "high" | "urgent";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  attachmentDocumentId: string | null;
  targetAudience: TargetAudience;
  targetDepartmentId: string | null;
  targetFamilyId: string | null;
  targetEventId: string | null;
  targetUserIds: string[];
  priority: AnnouncementPriority;
  publishAt: string;
  expiryAt: string | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementInput {
  title: string;
  message: string;
  imageUrl?: string | null;
  attachmentDocumentId?: string | null;
  targetAudience?: TargetAudience;
  targetDepartmentId?: string | null;
  targetFamilyId?: string | null;
  targetEventId?: string | null;
  targetUserIds?: string[];
  priority?: AnnouncementPriority;
  publishAt?: string;
  expiryAt?: string | null;
  /**
   * Resolved server-side from the signed-in caller's own session
   * (`auth.getCurrentUserWithRoles(supabase).id`), never taken from a
   * client-supplied form field — the same "authorship is derived, not
   * trusted" shape as `expenses.createExpenseRequest`'s `requestedBy`.
   */
  authorId: string;
}

export type UpdateAnnouncementInput = Omit<CreateAnnouncementInput, "authorId">;
