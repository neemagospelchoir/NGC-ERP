import type { Metadata } from "next";
import { auth, discipline } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createCaseAction } from "../actions";
import { CaseCreateForm } from "../case-form";

export const metadata: Metadata = { title: "Open case — NGC ERP" };

const MANAGE_PERMISSION = "discipline.cases.manage";

/** Re-checks the permission here too, not just at the list page — a direct URL visit must not bypass it (same pattern as attendance/new/page.tsx). */
export default async function NewDisciplineCasePage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  if (!canManage) {
    return (
      <>
        <PageHeader title="Open case" breadcrumb={["NGC ERP", "Discipline"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to open a disciplinary case.</p>
        </Card>
      </>
    );
  }

  const categoryOptions = (await discipline.listDisciplineCategories(supabase)).map((c) => ({ value: c.code, label: c.label }));

  return (
    <>
      <PageHeader title="Open case" breadcrumb={["NGC ERP", "Discipline"]} />
      <Card>
        <CardHeader>
          <CardTitle>New disciplinary case</CardTitle>
        </CardHeader>
        <CaseCreateForm action={createCaseAction} categoryOptions={categoryOptions} />
      </Card>
    </>
  );
}
