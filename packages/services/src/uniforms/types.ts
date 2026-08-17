export type UniformCondition = "new" | "good" | "fair" | "poor" | "retired";
export type UniformAssignmentStatus = "assigned" | "returned" | "damaged" | "lost";
export type ReturnCondition = "good" | "damaged" | "lost";

export interface UniformCategoryOption {
  code: string;
  label: string;
}

export interface Uniform {
  id: string;
  uniformType: string;
  size: string | null;
  quantityTotal: number;
  quantityAvailable: number;
  condition: UniformCondition;
  storageLocation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UniformAssignment {
  id: string;
  uniformId: string;
  memberId: string;
  eventId: string | null;
  quantity: number;
  assignedAt: string;
  assignedBy: string | null;
  returnedAt: string | null;
  returnCondition: ReturnCondition | null;
  status: UniformAssignmentStatus;
  createdAt: string;
}

export interface CreateUniformInput {
  uniformType: string;
  size?: string | null;
  quantityTotal: number;
  condition?: UniformCondition;
  storageLocation?: string | null;
}

export interface UpdateUniformInput {
  uniformType?: string;
  size?: string | null;
  quantityTotal?: number;
  /** Direct manual correction — e.g. crediting stock back after an off-system repair. See assign.ts's doc comment for why this isn't automated. */
  quantityAvailable?: number;
  storageLocation?: string | null;
}

export interface AssignUniformInput {
  uniformId: string;
  memberId: string;
  eventId?: string | null;
  quantity?: number;
  assignedBy?: string | null;
}

export interface ReturnUniformAssignmentInput {
  assignmentId: string;
  returnCondition: ReturnCondition;
  returnedAt?: string;
}
