export type CommentOwnerType =
  | "disciplinary_case"
  | "invitation"
  | "agenda"
  | "expense_request"
  | "gate_pass"
  | "application"
  | "procurement_request";

export interface CommentSummary {
  id: string;
  ownerType: CommentOwnerType;
  ownerId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddCommentInput {
  ownerType: CommentOwnerType;
  ownerId: string;
  authorId: string;
  body: string;
  /** Defaults to `true` (internal-only). Set `false` only for a note the external submitter/requester is meant to see — e.g. Invitations' "pending_information" request. See 0018_comments.sql's `is_internal` column doc. */
  isInternal?: boolean;
}
