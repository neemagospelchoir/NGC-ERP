export type GatePassStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "checked_out"
  | "in_transit"
  | "returned"
  | "partially_returned"
  | "damaged"
  | "lost";

export type ReturnCondition = "good" | "damaged" | "lost";

export interface GatePass {
  id: string;
  gatePassNumber: string;
  eventId: string;
  personResponsibleId: string;
  departmentId: string | null;
  expectedDeparture: string | null;
  expectedReturn: string | null;
  status: GatePassStatus;
  qrToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface GatePassItem {
  id: string;
  gatePassId: string;
  assetId: string;
  quantity: number;
  checkedOutAt: string | null;
  returnedAt: string | null;
  returnCondition: ReturnCondition | null;
  createdAt: string;
}

export interface CreateGatePassInput {
  eventId: string;
  personResponsibleId: string;
  departmentId?: string | null;
  expectedDeparture?: string | null;
  expectedReturn?: string | null;
}

export interface AddGatePassItemInput {
  assetId: string;
  quantity?: number;
  /** Server-derived from the acting user's session — never trusted from client input (see actions.ts). */
  assignedBy?: string | null;
  expectedReturnAt?: string | null;
  /** Forwarded verbatim to `inventory.assignAsset` — see add-item.ts's doc comment for why adding a gate pass item IS the equipment-assignment action, not a separate step. */
  override?: boolean;
}

export interface ReturnGatePassItemInput {
  itemId: string;
  condition: ReturnCondition;
}
