import type { Database } from "@ngc/db";
import type { Family } from "./types";

type FamilyRow = Database["public"]["Tables"]["families"]["Row"];

export function mapFamilyRow(row: FamilyRow): Family {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    leaderUserId: row.leader_user_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
