import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, expenses, inventory, procurement, vendors } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import {
  cancelProcurementRequestAction,
  createAssetForPurchaseOrderAction,
  recordPaymentAction,
  recordPurchaseAction,
  selectVendorAction,
} from "../actions";
import { CreateAssetForm, RecordPaymentForm, RecordPurchaseForm, VendorSelectForm } from "../procurement-action-forms";
import { paymentStatusLabel, paymentStatusTone, procurementStatusLabel, procurementStatusTone } from "../status";

export const metadata: Metadata = { title: "Procurement request — NGC ERP" };

const READ_PERMISSIONS = ["finance.procurement.manage", "finance.expenses.manage"];
const MANAGE_PERMISSION = "finance.procurement.manage";

function formatAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

/**
 * Gated the same way as the list page (`finance.procurement.manage` OR
 * `finance.expenses.manage` to read, `finance.procurement.manage` alone to
 * act) — Procurement has no self-service reader the way Expenses'/
 * Contributions' detail pages do, so this page needs its own explicit
 * "you don't have permission" branch, mirroring Gate Pass's detail page
 * rather than Expenses'/Leave's RLS-returns-null-so-404 shape.
 */
export default async function ProcurementDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser && READ_PERMISSIONS.some((p) => currentUser.permissionCodes.includes(p)));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Procurement request" breadcrumb={["NGC ERP", "Procurement"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view procurement.</p>
        </Card>
      </>
    );
  }

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const request = await procurement.getProcurementRequest(supabase, params.id);
  if (!request) notFound();

  const [expenseRequest, purchaseOrders, vendorRows, categories] = await Promise.all([
    expenses.getExpenseRequest(supabase, request.expenseRequestId),
    procurement.listPurchaseOrders(supabase, request.id),
    vendors.listVendors(supabase, { status: "active" }),
    inventory.listAssetCategories(supabase),
  ]);

  const vendorOptions = vendorRows.map((v) => ({ value: v.id, label: v.name }));
  const vendorNameById = new Map(vendorRows.map((v) => [v.id, v.name]));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  const canSelectVendor = canManage && request.status === "pending";
  const canRecordPurchase = canManage && request.status === "vendor_selected";
  const canCancel = canManage && request.status !== "purchased" && request.status !== "cancelled";

  const boundSelectVendor = selectVendorAction.bind(null, request.id);
  const boundRecordPurchase = recordPurchaseAction.bind(null, request.id);
  const cancel = async () => {
    "use server";
    await cancelProcurementRequestAction(request.id);
  };

  return (
    <>
      <PageHeader
        title={request.description}
        breadcrumb={["NGC ERP", "Procurement"]}
        action={<StatusPill tone={procurementStatusTone(request.status)} label={procurementStatusLabel(request.status)} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Expense request</dt>
                <dd className="text-sm text-ink-primary">
                  {expenseRequest ? `${expenseRequest.requestNumber} — ${expenseRequest.description}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Vendor</dt>
                <dd className="text-sm text-ink-primary">{request.vendorId ? vendorNameById.get(request.vendorId) ?? "—" : "Not yet selected"}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase orders</CardTitle>
            </CardHeader>
            {purchaseOrders.length === 0 ? (
              <p className="text-sm text-ink-secondary">No purchase has been recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {purchaseOrders.map((order) => (
                  <li key={order.id} className="border-b border-hairline pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink-primary">{formatAmount(order.amount, order.currency)}</p>
                      <StatusPill tone={paymentStatusTone(order.paymentStatus)} label={paymentStatusLabel(order.paymentStatus)} />
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      Purchased {order.purchasedAt ? new Date(order.purchasedAt).toLocaleDateString() : "—"}
                      {order.paidAt ? ` · Paid ${new Date(order.paidAt).toLocaleDateString()}` : ""}
                    </p>
                    {order.createdAssetId ? (
                      <p className="mt-2 text-sm text-ink-secondary">Inventory record created.</p>
                    ) : (
                      canManage && (
                        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                          {order.paymentStatus === "unpaid" && (
                            <div className="min-w-[220px] flex-1">
                              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Record payment</p>
                              <RecordPaymentForm action={recordPaymentAction.bind(null, order.id, request.id)} />
                            </div>
                          )}
                          <div className="min-w-[220px] flex-1">
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Create inventory record</p>
                            <CreateAssetForm
                              action={createAssetForPurchaseOrderAction.bind(null, order.id, request.id)}
                              categoryOptions={categoryOptions}
                            />
                          </div>
                        </div>
                      )
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {canSelectVendor && (
            <Card>
              <CardHeader>
                <CardTitle>Select vendor</CardTitle>
              </CardHeader>
              <VendorSelectForm action={boundSelectVendor} vendorOptions={vendorOptions} />
            </Card>
          )}

          {canRecordPurchase && (
            <Card>
              <CardHeader>
                <CardTitle>Record purchase</CardTitle>
              </CardHeader>
              <RecordPurchaseForm action={boundRecordPurchase} vendorOptions={vendorOptions} defaultVendorId={request.vendorId} />
            </Card>
          )}

          {canCancel && (
            <Card>
              <CardHeader>
                <CardTitle>Cancel</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">Cancels this procurement request. This cannot be undone.</p>
              <form action={cancel}>
                <Button type="submit" variant="secondary" size="sm">
                  Cancel request
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
