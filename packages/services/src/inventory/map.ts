import type { Database } from "@ngc/db";
import type {
  Asset,
  AssetAssignment,
  AssetAssignmentStatus,
  AssetAssignmentTargetType,
  AssetAvailabilityStatus,
  AssetCategory,
  AssetCondition,
  ReturnCondition,
} from "./types";

type AssetCategoryRow = Database["public"]["Tables"]["asset_categories"]["Row"];
type AssetRow = Database["public"]["Tables"]["assets"]["Row"];
type AssetAssignmentRow = Database["public"]["Tables"]["asset_assignments"]["Row"];

export function mapAssetCategoryRow(row: AssetCategoryRow): AssetCategory {
  return { id: row.id, name: row.name, description: row.description, isActive: row.is_active, createdAt: row.created_at };
}

export function mapAssetRow(row: AssetRow): Asset {
  return {
    id: row.id,
    assetTag: row.asset_tag,
    categoryId: row.category_id,
    name: row.name,
    serialNumber: row.serial_number,
    purchaseDate: row.purchase_date,
    purchaseValue: row.purchase_value,
    currentValue: row.current_value,
    currency: row.currency,
    condition: row.condition as AssetCondition,
    location: row.location,
    custodianUserId: row.custodian_user_id,
    owningDepartmentId: row.owning_department_id,
    availabilityStatus: row.availability_status as AssetAvailabilityStatus,
    photoUrls: row.photo_urls ?? [],
    qrToken: row.qr_token,
    disposedAt: row.disposed_at,
    disposalReason: row.disposal_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAssetAssignmentRow(row: AssetAssignmentRow): AssetAssignment {
  return {
    id: row.id,
    assetId: row.asset_id,
    targetType: row.target_type as AssetAssignmentTargetType,
    targetId: row.target_id,
    quantity: row.quantity,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    expectedReturnAt: row.expected_return_at,
    returnedAt: row.returned_at,
    returnCondition: row.return_condition as ReturnCondition | null,
    damageReport: row.damage_report,
    status: row.status as AssetAssignmentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
