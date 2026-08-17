export type AssetCondition = "new" | "good" | "fair" | "poor" | "damaged" | "disposed";
export type AssetAvailabilityStatus = "available" | "assigned" | "under_maintenance" | "missing" | "disposed";
export type AssetAssignmentTargetType = "member" | "department" | "event";
export type AssetAssignmentStatus = "assigned" | "returned" | "partially_returned" | "damaged" | "lost";
export type ReturnCondition = "good" | "damaged" | "lost";

export interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Asset {
  id: string;
  assetTag: string;
  categoryId: string;
  name: string;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchaseValue: number | null;
  currentValue: number | null;
  currency: string;
  condition: AssetCondition;
  location: string | null;
  custodianUserId: string | null;
  owningDepartmentId: string | null;
  availabilityStatus: AssetAvailabilityStatus;
  photoUrls: string[];
  qrToken: string;
  disposedAt: string | null;
  disposalReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  targetType: AssetAssignmentTargetType;
  targetId: string;
  quantity: number;
  assignedBy: string | null;
  assignedAt: string;
  expectedReturnAt: string | null;
  returnedAt: string | null;
  returnCondition: ReturnCondition | null;
  damageReport: string | null;
  status: AssetAssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetInput {
  categoryId: string;
  name: string;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchaseValue?: number | null;
  currentValue?: number | null;
  currency?: string;
  condition?: AssetCondition;
  location?: string | null;
  custodianUserId?: string | null;
  owningDepartmentId?: string | null;
  photoUrls?: string[];
}

export interface UpdateAssetInput {
  categoryId?: string;
  name?: string;
  serialNumber?: string | null;
  purchaseDate?: string | null;
  purchaseValue?: number | null;
  currentValue?: number | null;
  currency?: string;
  condition?: AssetCondition;
  location?: string | null;
  custodianUserId?: string | null;
  owningDepartmentId?: string | null;
  photoUrls?: string[];
}

export interface AssignAssetInput {
  assetId: string;
  targetType: AssetAssignmentTargetType;
  targetId: string;
  quantity?: number;
  assignedBy?: string | null;
  expectedReturnAt?: string | null;
  /**
   * PRD §7.6: the system "blocks double-booking absent explicit override."
   * Only meaningful when the asset is not currently `available` — set to
   * true to proceed anyway (e.g. a manager knowingly double-assigns a
   * consumable-style asset). Never bypasses the *event* double-booking
   * database backstop (`uq_asset_assignments_no_concurrent_event_booking`,
   * 0010) — that unique index has no override, by design.
   */
  override?: boolean;
}

export interface ReturnAssignmentInput {
  assignmentId: string;
  returnCondition: ReturnCondition;
  damageReport?: string | null;
  returnedAt?: string;
}
