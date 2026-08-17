import type { Database } from "@ngc/db";
import type { GatePass, GatePassItem, GatePassStatus, ReturnCondition } from "./types";

type GatePassRow = Database["public"]["Tables"]["gate_passes"]["Row"];
type GatePassItemRow = Database["public"]["Tables"]["gate_pass_items"]["Row"];

export function mapGatePassRow(row: GatePassRow): GatePass {
  return {
    id: row.id,
    gatePassNumber: row.gate_pass_number,
    eventId: row.event_id,
    personResponsibleId: row.person_responsible_id,
    departmentId: row.department_id,
    expectedDeparture: row.expected_departure,
    expectedReturn: row.expected_return,
    status: row.status as GatePassStatus,
    qrToken: row.qr_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGatePassItemRow(row: GatePassItemRow): GatePassItem {
  return {
    id: row.id,
    gatePassId: row.gate_pass_id,
    assetId: row.asset_id,
    quantity: row.quantity,
    checkedOutAt: row.checked_out_at,
    returnedAt: row.returned_at,
    returnCondition: row.return_condition as ReturnCondition | null,
    createdAt: row.created_at,
  };
}
