import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, inventory } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { assignAssetAction, disposeAssetAction, returnAssignmentAction, updateAssetAction } from "../actions";
import { AssetForm } from "../asset-form";
import { AssignAssetForm, DisposeAssetForm, ReturnAssignmentForm } from "../assign-form";

export const metadata: Metadata = { title: "Asset — NGC ERP" };

const READ_PERMISSIONS = ["inventory.assets.manage", "inventory.categories.manage", "technical.equipment.assign"];
const MANAGE_PERMISSION = "inventory.assets.manage";
const ASSIGN_PERMISSIONS = ["inventory.assets.manage", "technical.equipment.assign"];

const AVAILABILITY_TONE = {
  available: "good",
  assigned: "neutral",
  under_maintenance: "warning",
  missing: "critical",
  disposed: "critical",
} as const;

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default async function AssetDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser && READ_PERMISSIONS.some((p) => currentUser.permissionCodes.includes(p)));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Asset" breadcrumb={["NGC ERP", "Assets"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view the asset registry.</p>
        </Card>
      </>
    );
  }

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));
  const canAssign = Boolean(currentUser && ASSIGN_PERMISSIONS.some((p) => currentUser.permissionCodes.includes(p)));

  const [asset, categories] = await Promise.all([inventory.getAsset(supabase, params.id), inventory.listAssetCategories(supabase, { includeInactive: true })]);
  if (!asset) notFound();

  const assignments = await inventory.listAssetAssignments(supabase, asset.id);
  const activeAssignment = assignments.find((a) => !a.returnedAt);

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const boundUpdate = updateAssetAction.bind(null, asset.id);
  const boundAssign = assignAssetAction.bind(null, asset.id);
  const boundDispose = disposeAssetAction.bind(null, asset.id);
  const boundReturn = activeAssignment ? returnAssignmentAction.bind(null, asset.id, activeAssignment.id) : null;

  return (
    <>
      <PageHeader
        title={asset.assetTag}
        breadcrumb={["NGC ERP", "Assets", asset.name]}
        action={<StatusPill tone={AVAILABILITY_TONE[asset.availabilityStatus]} label={labelize(asset.availabilityStatus)} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            {canManage ? (
              <AssetForm action={boundUpdate} categoryOptions={categoryOptions} initial={asset} submitLabel="Save changes" pendingLabel="Saving…" />
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Serial number</dt>
                  <dd className="text-sm text-ink-primary">{asset.serialNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Condition</dt>
                  <dd className="text-sm text-ink-primary">{labelize(asset.condition)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Location</dt>
                  <dd className="text-sm text-ink-primary">{asset.location ?? "—"}</dd>
                </div>
              </dl>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment history</CardTitle>
            </CardHeader>
            {assignments.length === 0 ? (
              <p className="text-sm text-ink-secondary">This asset has never been assigned.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {assignments.map((a) => (
                  <li key={a.id} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-ink-primary">
                      {labelize(a.targetType)} {a.targetId} — {labelize(a.status)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Assigned {new Date(a.assignedAt).toLocaleString()}
                      {a.returnedAt && ` · Returned ${new Date(a.returnedAt).toLocaleString()}`}
                    </p>
                    {a.damageReport && <p className="mt-1 text-sm text-ink-secondary">{a.damageReport}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {canAssign && (
          <div className="flex flex-col gap-6">
            {activeAssignment ? (
              <Card>
                <CardHeader>
                  <CardTitle>Record return</CardTitle>
                </CardHeader>
                <p className="mb-3 text-sm text-ink-secondary">
                  Currently assigned to {labelize(activeAssignment.targetType)} {activeAssignment.targetId}.
                </p>
                {boundReturn && <ReturnAssignmentForm action={boundReturn} />}
              </Card>
            ) : (
              asset.availabilityStatus !== "disposed" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Assign this asset</CardTitle>
                  </CardHeader>
                  <AssignAssetForm action={boundAssign} />
                </Card>
              )
            )}

            {canManage && asset.availabilityStatus !== "disposed" && (
              <Card>
                <CardHeader>
                  <CardTitle>Dispose</CardTitle>
                </CardHeader>
                <p className="mb-3 text-sm text-ink-secondary">
                  Disposal never deletes this record — every past assignment stays intact and queryable.
                </p>
                <DisposeAssetForm action={boundDispose} />
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
