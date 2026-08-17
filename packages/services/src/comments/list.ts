import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import { mapCommentSummary } from "./map";
import type { AddCommentInput, CommentOwnerType, CommentSummary } from "./types";

/**
 * Generic reader/writer for the polymorphic `comments` table
 * (0018_comments.sql) — the first real caller of it in this codebase
 * (Invitations, Phase 7.5). `comments_select_scoped`/`comments_insert_
 * scoped` RLS is already owner-type-aware (a comment on a
 * `disciplinary_case` requires `discipline.cases.read` regardless of
 * anything this module does), so no application-layer permission check is
 * duplicated here — same "trust Postgres" pattern as the rest of this
 * codebase. This module is intentionally generic so a future phase
 * (Discipline's own investigation notes, Expense requests, Gate Passes)
 * can reuse it rather than growing a bespoke comments table per module.
 */
export async function listComments(
  client: SupabaseClient<Database>,
  ownerType: CommentOwnerType,
  ownerId: string
): Promise<CommentSummary[]> {
  const { data, error } = await client
    .from("comments")
    .select("*")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });

  if (error) throw new ServiceError("Could not load comments.", error);
  return (data ?? []).map(mapCommentSummary);
}

export async function addComment(client: SupabaseClient<Database>, input: AddCommentInput): Promise<CommentSummary> {
  const body = input.body.trim();
  if (!body) {
    throw new ServiceError("A comment cannot be empty.");
  }

  const { data, error } = await client
    .from("comments")
    .insert({
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      author_id: input.authorId,
      body,
      is_internal: input.isInternal ?? true,
    })
    .select("*")
    .single();

  if (error) throw new ServiceError("Could not post the comment.", error);
  return mapCommentSummary(data);
}
