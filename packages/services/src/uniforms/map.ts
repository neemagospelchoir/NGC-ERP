import type { Database } from "@ngc/db";
import type { Uniform, UniformAssignment, UniformAssignmentStatus, UniformCondition, ReturnCondition } from "./types";

type UniformRow = Database["public"]["Tables"]["uniforms"]["Row"];
type UniformAssignmentRow = Database["public"]["Tables"]["uniform_assignments"]["Row"];

export function mapUniformRow(row: UniformRow): Uniform {
  return {
    id: row.id,
    uniformType: row.uniform_type,
    size: row.size,
    quantityTotal: row.quantity_total,
    quantityAvailable: row.quantity_available,
    condition: row.condition as UniformCondition,
    storageLocation: row.storage_location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapUniformAssignmentRow(row: UniformAssignmentRow): UniformAssignment {
  return {
    id: row.id,
    uniformId: row.uniform_id,
    memberId: row.member_id,
    eventId: row.event_id,
    quantity: row.quantity,
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
    returnedAt: row.returned_at,
    returnCondition: row.return_condition as ReturnCondition | null,
    status: row.status as UniformAssignmentStatus,
    createdAt: row.created_at,
  };
}
