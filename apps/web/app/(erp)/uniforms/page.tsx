import type { Metadata } from "next";
import { auth, uniforms } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createUniformAction } from "./actions";
import { UniformForm } from "./uniform-form";
import { UniformsTable } from "./uniforms-table";

export const metadata: Metadata = { title: "Uniforms — NGC ERP" };

const MANAGE_PERMISSION = "uniform.inventory.manage";

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Unlike Vendors/Assets (gated on a specific permission because there's no
 * legitimate self-service angle for a plain member), this page is always
 * visible — `uniforms_select_internal` RLS (0012) already lets any
 * signed-in user read the catalog, and `uniform_assignments_select_scoped`
 * legitimately lets every member see their OWN issued items, exactly like
 * Attendance/Leave's "always visible" nav treatment. Only the catalog
 * management (create form, edit, assign/return) is gated on
 * `uniform.inventory.manage`, matching `uniforms_write_scoped`/
 * `uniform_assignments_write_scoped` RLS exactly.
 */
export default async function UniformsPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const [categories, rows, myAssignments] = await Promise.all([
    uniforms.listUniformCategories(supabase),
    uniforms.listUniforms(supabase),
    currentUser?.member ? uniforms.listAssignmentsForMember(supabase, currentUser.member.id) : Promise.resolve([]),
  ]);
  const categoryOptions = categories.map((c) => ({ value: c.code, label: c.label }));
  const categoryLabelByCode = new Map(categories.map((c) => [c.code, c.label]));
  const uniformById = new Map(rows.map((u) => [u.id, u]));

  return (
    <>
      <PageHeader title="Uniforms" breadcrumb={["NGC ERP"]} />

      {currentUser?.member && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>My uniform issues</CardTitle>
          </CardHeader>
          {myAssignments.length === 0 ? (
            <p className="text-sm text-ink-secondary">You have no uniform items currently issued to you.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {myAssignments.map((a) => {
                const uniformType = uniformById.get(a.uniformId)?.uniformType;
                const uniformLabel = uniformType ? categoryLabelByCode.get(uniformType) ?? labelize(uniformType) : "Uniform";
                return (
                  <li key={a.id} className="border-b border-hairline pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-ink-primary">
                      {uniformLabel} — Qty {a.quantity} — {labelize(a.status)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Issued {new Date(a.assignedAt).toLocaleDateString()}
                      {a.returnedAt && ` · Returned ${new Date(a.returnedAt).toLocaleDateString()}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <UniformsTable rows={rows} categoryLabelByCode={categoryLabelByCode} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Add a uniform</CardTitle>
            </CardHeader>
            {categoryOptions.length === 0 ? (
              <p className="text-sm text-ink-secondary">
                No active uniform categories are configured (`lookup_values`, category=&quot;uniform_category&quot;). An administrator needs to add one before a uniform can be registered.
              </p>
            ) : (
              <UniformForm action={createUniformAction} categoryOptions={categoryOptions} submitLabel="Add uniform" pendingLabel="Adding…" />
            )}
          </Card>
        )}
      </div>
    </>
  );
}
