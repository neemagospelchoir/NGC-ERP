import type { Metadata } from "next";
import { auth, inventory } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createAssetAction } from "./actions";
import { AssetForm } from "./asset-form";
import { AssetsTable } from "./assets-table";

export const metadata: Metadata = { title: "Assets — NGC ERP" };

const READ_PERMISSIONS = ["inventory.assets.manage", "inventory.categories.manage", "technical.equipment.assign"];
const MANAGE_PERMISSION = "inventory.assets.manage";

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "assigned", label: "Assigned" },
  { value: "under_maintenance", label: "Under maintenance" },
  { value: "missing", label: "Missing" },
  { value: "disposed", label: "Disposed" },
];

/**
 * `assets_select_internal` RLS (0010) lets any signed-in user read this
 * table — the PRD Permission Matrix (§6) names Choir Member as having no
 * Inventory/Assets access at all, and Department Leader as "Read", but
 * neither has a corresponding seeded permission grant today (only Inventory
 * Officer and Technical Manager hold `inventory.*`/`technical.equipment.assign`
 * — see docs/PHASE_8_1.md §4 "Open issues"). This page's permission gate
 * therefore under-serves Department Leader relative to the PRD (they see
 * nothing here yet, same as a plain Choir Member) rather than over-serving
 * them — a deliberate, documented gap, not a silent guess at a permission
 * grant nobody has asked for.
 */
export default async function AssetsPage(
  props: {
    searchParams: Promise<{ category?: string; availability?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser && READ_PERMISSIONS.some((p) => currentUser.permissionCodes.includes(p)));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Assets" breadcrumb={["NGC ERP"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view the asset registry.</p>
        </Card>
      </>
    );
  }

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const [categories, rows] = await Promise.all([
    inventory.listAssetCategories(supabase),
    inventory.listAssets(supabase, {
      categoryId: searchParams.category || undefined,
      availabilityStatus: (searchParams.availability as inventory.AssetAvailabilityStatus) || undefined,
    }),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <>
      <PageHeader title="Assets" breadcrumb={["NGC ERP"]} />
      <Card className="mb-6">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" method="get">
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Category
            <select
              name="category"
              defaultValue={searchParams.category ?? ""}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            >
              <option value="">All categories</option>
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Availability
            <select
              name="availability"
              defaultValue={searchParams.availability ?? ""}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            >
              <option value="">All statuses</option>
              {AVAILABILITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md border border-brand-300 bg-transparent px-4 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Apply filters
            </button>
          </div>
        </form>
      </Card>
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <AssetsTable rows={rows} categoryNameById={categoryNameById} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Add an asset</CardTitle>
            </CardHeader>
            <AssetForm action={createAssetAction} categoryOptions={categoryOptions} submitLabel="Add asset" pendingLabel="Adding…" />
          </Card>
        )}
      </div>
    </>
  );
}
