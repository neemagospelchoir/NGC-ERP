import type { Metadata } from "next";
import { auth } from "@ngc/services";
import { Card, CardHeader, CardTitle, ErrorState, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createLeaveRequestAction } from "../actions";
import { LeaveCreateForm } from "../leave-form";

export const metadata: Metadata = { title: "Request leave — NGC ERP" };

/**
 * `leave_requests_insert_self` RLS (0006) requires the request's
 * `member_id` to be the caller's own member record — a signed-in user with
 * no member record at all (e.g. an admin-only account) has no "own
 * request" to make, so this refuses outright rather than showing a form
 * that could never succeed.
 */
export default async function NewLeaveRequestPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);

  if (!currentUser?.member) {
    return (
      <>
        <PageHeader title="Request leave" breadcrumb={["NGC ERP", "Leave"]} />
        <ErrorState
          title="No member record found"
          description="Only a signed-in choir member can request leave. Contact an administrator if you believe this is a mistake."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Request leave" breadcrumb={["NGC ERP", "Leave"]} />
      <div className="lg:max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Leave details</CardTitle>
          </CardHeader>
          <LeaveCreateForm action={createLeaveRequestAction} />
        </Card>
      </div>
    </>
  );
}
