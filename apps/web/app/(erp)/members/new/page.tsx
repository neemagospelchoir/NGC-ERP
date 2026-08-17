import type { Metadata } from "next";
import { auth, departments, families } from "@ngc/services";
import { Card, CardHeader, CardTitle, ErrorState, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createMemberAction } from "../actions";
import { MemberCreateForm } from "../member-forms";

export const metadata: Metadata = { title: "Add member — NGC ERP" };

const MANAGE_PERMISSION = "members.profiles.manage";

/**
 * `members_write_hr` (0004) requires members.profiles.manage for the
 * eventual insert regardless of what this page shows — this check exists
 * so a non-HR member who navigates here directly sees a clear "you don't
 * have permission" state instead of filling out a form that would only
 * fail with a generic error on submit (the same reasoning as the Members
 * list page hiding the "Add member" button, and the detail page's
 * canManage branch).
 */
export default async function NewMemberPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  if (!canManage) {
    return (
      <>
        <PageHeader title="Add a member" breadcrumb={["NGC ERP", "Members"]} />
        <ErrorState
          title="You don't have permission to add a member"
          description="Adding a member directly is restricted to HR/admin roles. Contact an administrator if you believe you should have access."
        />
      </>
    );
  }

  const [departmentRows, familyRows] = await Promise.all([
    departments.listDepartments(supabase),
    families.listFamilies(supabase),
  ]);

  return (
    <>
      <PageHeader title="Add a member" breadcrumb={["NGC ERP", "Members"]} />
      <div className="lg:max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Member details</CardTitle>
          </CardHeader>
          <p className="mb-4 text-sm text-ink-secondary">
            New members always start in the <strong>probation</strong> stage of the membership lifecycle — this
            matches the direct-creation path used by HR; the Onboarding module (a later phase) will offer the
            application-review path instead.
          </p>
          <MemberCreateForm
            action={createMemberAction}
            departmentOptions={departmentRows.map((d) => ({ value: d.id, label: d.name }))}
            familyOptions={familyRows.map((f) => ({ value: f.id, label: f.name }))}
          />
        </Card>
      </div>
    </>
  );
}
