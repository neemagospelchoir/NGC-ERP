import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, departments } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { updateDepartmentAction, toggleDepartmentActiveAction } from "../actions";
import { DepartmentForm } from "../department-form";

export const metadata: Metadata = { title: "Edit department — NGC ERP" };

const MANAGE_PERMISSION = "admin.departments.manage";

export default async function DepartmentDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const [department, currentUser] = await Promise.all([
    departments.getDepartment(supabase, params.id),
    auth.getCurrentUserWithRoles(supabase),
  ]);
  if (!department) notFound();

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const boundUpdate = updateDepartmentAction.bind(null, department.id);
  const toggleActive = async () => {
    "use server";
    await toggleDepartmentActiveAction(department.id, !department.isActive);
  };

  return (
    <>
      <PageHeader
        title={department.name}
        breadcrumb={["NGC ERP", "Departments"]}
        action={department.isActive ? <StatusPill tone="good" label="Active" /> : <StatusPill tone="neutral" label="Inactive" />}
      />
      <div className="grid grid-cols-1 gap-6 lg:max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          {canManage ? (
            <DepartmentForm
              action={boundUpdate}
              initialName={department.name}
              initialDescription={department.description}
              submitLabel="Save changes"
              pendingLabel="Saving…"
            />
          ) : (
            <p className="text-sm text-ink-primary">{department.description ?? "No description."}</p>
          )}
        </Card>
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>{department.isActive ? "Deactivate" : "Reactivate"}</CardTitle>
            </CardHeader>
            <p className="mb-3 text-sm text-ink-secondary">
              {department.isActive
                ? "Deactivating hides this department from active pickers and lists. It is never deleted — every past assignment and record stays intact."
                : "Reactivating makes this department selectable again in pickers and lists."}
            </p>
            <form action={toggleActive}>
              <Button type="submit" variant={department.isActive ? "destructive" : "primary"}>
                {department.isActive ? "Deactivate department" : "Reactivate department"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
