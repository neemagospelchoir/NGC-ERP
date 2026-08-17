import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, vendors } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { setVendorStatusAction, updateVendorAction } from "../actions";
import { VendorForm } from "../vendor-form";

export const metadata: Metadata = { title: "Vendor — NGC ERP" };

const READ_PERMISSIONS = ["logistics.vendors.manage", "finance.vendors.manage"];
const FINANCIAL_PERMISSION = "finance.vendors.manage";

const STATUS_TONE = { active: "good", inactive: "neutral", blacklisted: "critical" } as const;

export default async function VendorDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser && READ_PERMISSIONS.some((p) => currentUser.permissionCodes.includes(p)));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Vendor" breadcrumb={["NGC ERP", "Vendors"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view vendors.</p>
        </Card>
      </>
    );
  }

  const canSeeFinancial = Boolean(currentUser?.permissionCodes.includes(FINANCIAL_PERMISSION));
  const [vendor, categories] = await Promise.all([
    vendors.getVendor(supabase, params.id, { includeFinancial: canSeeFinancial }),
    vendors.listVendorCategories(supabase),
  ]);
  if (!vendor) notFound();

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const boundUpdate = updateVendorAction.bind(null, vendor.id);

  return (
    <>
      <PageHeader
        title={vendor.name}
        breadcrumb={["NGC ERP", "Vendors"]}
        action={<StatusPill tone={STATUS_TONE[vendor.status]} label={vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <VendorForm
            action={boundUpdate}
            categoryOptions={categoryOptions}
            canSeeFinancial={canSeeFinancial}
            initial={vendor}
            submitLabel="Save changes"
            pendingLabel="Saving…"
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <p className="mb-3 text-sm text-ink-secondary">
            Blacklisting a vendor keeps its record (and history) intact but flags it so Logistics/Procurement know not to select it for new work.
          </p>
          <div className="flex gap-2">
            {(["active", "inactive", "blacklisted"] as const)
              .filter((s) => s !== vendor.status)
              .map((s) => {
                const action = async () => {
                  "use server";
                  await setVendorStatusAction(vendor.id, s);
                };
                return (
                  <form key={s} action={action}>
                    <Button type="submit" variant={s === "blacklisted" ? "destructive" : "secondary"} size="sm">
                      Mark {s}
                    </Button>
                  </form>
                );
              })}
          </div>
        </Card>
      </div>
    </>
  );
}
