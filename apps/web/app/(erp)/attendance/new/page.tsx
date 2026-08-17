import type { Metadata } from "next";
import { auth, departments } from "@ngc/services";
import { Card, CardHeader, CardTitle, ErrorState, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createSessionAction } from "../actions";
import { SessionCreateForm } from "../session-form";

export const metadata: Metadata = { title: "New attendance session — NGC ERP" };

const MANAGE_PERMISSION = "attendance.records.manage";

/**
 * Reachable by direct URL regardless of what the list page shows, so this
 * re-checks directly rather than trusting a hidden link — same reasoning
 * as members/new. Allowed for anyone holding `attendance.records.manage`
 * OR any department-scoped role; RLS (`attendance_sessions_write_scoped`,
 * 0006) is still the real gate on whether the department they pick is
 * actually theirs.
 */
export default async function NewAttendanceSessionPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canCreate = Boolean(
    currentUser?.permissionCodes.includes(MANAGE_PERMISSION) || currentUser?.roles.some((r) => r.scopeType === "department")
  );

  if (!canCreate) {
    return (
      <>
        <PageHeader title="New attendance session" breadcrumb={["NGC ERP", "Attendance"]} />
        <ErrorState
          title="You don't have permission to create an attendance session"
          description="Creating a session is restricted to HR/admin roles or a department's own leader. Contact an administrator if you believe you should have access."
        />
      </>
    );
  }

  const departmentRows = await departments.listDepartments(supabase);

  return (
    <>
      <PageHeader title="New attendance session" breadcrumb={["NGC ERP", "Attendance"]} />
      <div className="lg:max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Session details</CardTitle>
          </CardHeader>
          <SessionCreateForm
            action={createSessionAction}
            departmentOptions={departmentRows.map((d) => ({ value: d.id, label: d.name }))}
          />
        </Card>
      </div>
    </>
  );
}
