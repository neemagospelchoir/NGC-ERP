import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, uniforms } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { assignUniformAction, returnUniformAssignmentAction, setUniformConditionAction, updateUniformAction } from "../actions";
import { AssignUniformForm, ReturnUniformAssignmentForm } from "../assign-form";
import { UniformForm } from "../uniform-form";

export const metadata: Metadata = { title: "Uniform — NGC ERP" };

const MANAGE_PERMISSION = "uniform.inventory.manage";

const CONDITION_TONE = { new: "good", good: "good", fair: "neutral", poor: "warning", retired: "critical" } as const;
const CONDITIONS = ["new", "good", "fair", "poor", "retired"] as const;

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Read access here is intentionally NOT gated by application code —
 * `uniforms_select_internal` lets any signed-in user see the catalog entry,
 * and `uniform_assignments_select_scoped` RLS (0012) already narrows the
 * assignment history below to exactly what the caller is allowed to see
 * (their own row, their department-leader scope, or everything if they
 * hold `uniform.inventory.manage`) — same "trust Postgres" pattern as the
 * cross-module Approval Center (docs/PHASE_7_5.md). Only the write forms
 * (edit, condition change, assign, return) are gated on `canManage`,
 * matching `uniforms_write_scoped`/`uniform_assignments_write_scoped` RLS,
 * which — unlike Assets' equivalent — grants no department-leader write
 * allowance at all.
 */
export default async function UniformDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const [uniform, categories] = await Promise.all([uniforms.getUniform(supabase, params.id), uniforms.listUniformCategories(supabase)]);
  if (!uniform) notFound();

  const assignments = await uniforms.listUniformAssignments(supabase, uniform.id);
  const outstanding = assignments.filter((a) => !a.returnedAt);

  const categoryOptions = categories.map((c) => ({ value: c.code, label: c.label }));
  const categoryLabelByCode = new Map(categories.map((c) => [c.code, c.label]));
  const uniformLabel = categoryLabelByCode.get(uniform.uniformType) ?? labelize(uniform.uniformType);
  const boundUpdate = updateUniformAction.bind(null, uniform.id);
  const boundAssign = assignUniformAction.bind(null, uniform.id);

  return (
    <>
      <PageHeader
        title={uniformLabel}
        breadcrumb={["NGC ERP", "Uniforms"]}
        action={<StatusPill tone={CONDITION_TONE[uniform.condition]} label={labelize(uniform.condition)} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            {canManage ? (
              <UniformForm
                key={`${uniform.condition}-${uniform.quantityAvailable}-${uniform.quantityTotal}`}
                action={boundUpdate}
                categoryOptions={categoryOptions}
                showQuantityAvailable
                initial={uniform}
                submitLabel="Save changes"
                pendingLabel="Saving…"
              />
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Size</dt>
                  <dd className="text-sm text-ink-primary">{uniform.size ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Available</dt>
                  <dd className="text-sm text-ink-primary">
                    {uniform.quantityAvailable} / {uniform.quantityTotal}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Storage location</dt>
                  <dd className="text-sm text-ink-primary">{uniform.storageLocation ?? "—"}</dd>
                </div>
              </dl>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment history</CardTitle>
            </CardHeader>
            {assignments.length === 0 ? (
              <p className="text-sm text-ink-secondary">No assignments recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {assignments.map((a) => {
                  const boundReturn = canManage ? returnUniformAssignmentAction.bind(null, uniform.id, a.id) : null;
                  return (
                    <li key={a.id} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-ink-primary">
                        Member {a.memberId} — Qty {a.quantity} — {labelize(a.status)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        Issued {new Date(a.assignedAt).toLocaleString()}
                        {a.eventId && ` · Event ${a.eventId}`}
                        {a.returnedAt && ` · Returned ${new Date(a.returnedAt).toLocaleString()}`}
                      </p>
                      {!a.returnedAt && boundReturn && (
                        <div className="mt-2 max-w-xs">
                          <ReturnUniformAssignmentForm action={boundReturn} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {outstanding.length === 0 && assignments.length > 0 && (
              <p className="mt-3 text-xs text-ink-muted">All issued units of this uniform have been returned.</p>
            )}
          </Card>
        </div>

        {canManage && (
          <div className="flex flex-col gap-6">
            {uniform.condition !== "retired" && (
              <Card>
                <CardHeader>
                  <CardTitle>Issue this uniform</CardTitle>
                </CardHeader>
                <p className="mb-3 text-sm text-ink-secondary">{uniform.quantityAvailable} available to issue.</p>
                <AssignUniformForm action={boundAssign} />
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Condition</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">
                Marking a uniform &quot;retired&quot; is permanent for this registry entry — it can no longer be issued, and its available
                quantity is zeroed.
              </p>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.filter((c) => c !== uniform.condition).map((c) => {
                  const setCondition = async () => {
                    "use server";
                    await setUniformConditionAction(uniform.id, c);
                  };
                  return (
                    <form key={c} action={setCondition}>
                      <Button type="submit" variant={c === "retired" ? "destructive" : "secondary"} size="sm">
                        Mark {labelize(c)}
                      </Button>
                    </form>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
