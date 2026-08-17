import type { Database } from "@ngc/db";
import type { Department } from "./types";

type DepartmentRow = Database["public"]["Tables"]["departments"]["Row"];

export function mapDepartmentRow(row: DepartmentRow): Department {
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
