import type { Database } from "@ngc/db";
import type { CommentOwnerType, CommentSummary } from "./types";

type CommentRow = Database["public"]["Tables"]["comments"]["Row"];

export function mapCommentSummary(row: CommentRow): CommentSummary {
  return {
    id: row.id,
    ownerType: row.owner_type as CommentOwnerType,
    ownerId: row.owner_id,
    authorId: row.author_id,
    body: row.body,
    isInternal: row.is_internal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
