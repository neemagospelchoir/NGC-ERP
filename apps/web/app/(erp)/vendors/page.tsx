import type { Metadata } from "next";
import { auth, vendors } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createVendorAction } from "./actions";
import { VendorForm } from "./vendor-form";
import { VendorsTable } from "./vendors-table";

export const metadata: Metadata = { title: "Vendors — NGC ERP" };

const READ_PERMISSIONS = ["logistics.vendors.manage", "finance.vendors.manage"];
const FINANCIAL_PERMISSION = "finance.vendors.manage";

/**
 * `vendors_select_internal` RLS (0013) lets any signed-in user read this
 * table — same "internal transparency" baseline as Invitations/Events (see
 * docs/PHASE_7_5.md §4). This page narrows *who sees the module at all* to
 * the PRD Permission Matrix's named roles (Logistics, Finance, plus
 * Super Admin's blanket grant) as an application-layer convenience, not a
 * database-layer restriction — consistent with every prior phase's
 * documented practice of not conflating the two.
 */
export default async function VendorsPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser && READ_PERMISSIONS.some((p) => currentUser.permissionCodes.includes(p)));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Vendors" breadcrumb={["NGC ERP"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view vendors.</p>
        </Card>
      </>
    );
  }

  const canSeeFinancial = Boolean(currentUser?.permissionCodes.includes(FINANCIAL_PERMISSION));
  const canManage = canRead; // both READ_PERMISSIONS also carry write rights per vendors_write_scoped RLS

  const [categories, rows] = await Promise.all([
    vendors.listVendorCategories(supabase),
    vendors.listVendors(supabase, { includeFinancial: canSeeFinancial }),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <>
      <PageHeader title="Vendors" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <VendorsTable rows={rows} categoryNameById={categoryNameById} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Add a vendor</CardTitle>
            </CardHeader>
            <VendorForm
              action={createVendorAction}
              categoryOptions={categoryOptions}
              canSeeFinancial={canSeeFinancial}
              submitLabel="Add vendor"
              pendingLabel="Adding…"
            />
          </Card>
        )}
      </div>
    </>
  );
}
