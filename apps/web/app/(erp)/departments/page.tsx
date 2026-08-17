import type { Metadata } from "next";
import { auth, departments } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createDepartmentAction } from "./actions";
import { DepartmentForm } from "./department-form";
import { DepartmentsTable } from "./departments-table";

export const metadata: Metadata = { title: "Departments — NGC ERP" };

const MANAGE_PERMISSION = "admin.departments.manage";

/**
 * `departments_read_authenticated` (0003) lets every signed-in user read
 * this list — the create form is the write side, gated by
 * `departments_write_admin`'s `admin.departments.manage` requirement.
 * Hiding the form for everyone else isn't itself the access-control
 * mechanism (RLS is, and would reject the insert regardless) — it just
 * keeps the UI from offering an action a non-admin would only see fail.
 */
export default async function DepartmentsPage() {
  const supabase = await createClient();
  const [rows, currentUser] = await Promise.all([
    departments.listDepartments(supabase, { includeInactive: true }),
    auth.getCurrentUserWithRoles(supabase),
  ]);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  return (
    <>
      <PageHeader title="Departments" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <DepartmentsTable rows={rows} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Add a department</CardTitle>
            </CardHeader>
            <DepartmentForm action={createDepartmentAction} submitLabel="Add department" pendingLabel="Adding…" />
          </Card>
        )}
      </div>
    </>
  );
}
