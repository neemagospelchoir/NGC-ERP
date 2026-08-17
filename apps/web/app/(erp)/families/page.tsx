import type { Metadata } from "next";
import { auth, families } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { createFamilyAction } from "./actions";
import { FamiliesTable } from "./families-table";
import { FamilyForm } from "./family-form";

export const metadata: Metadata = { title: "Families — NGC ERP" };

const MANAGE_PERMISSION = "admin.families.manage";

/** See departments/page.tsx's doc comment — same reasoning, `families_write_admin`'s permission instead. */
export default async function FamiliesPage() {
  const supabase = await createClient();
  const [rows, currentUser] = await Promise.all([
    families.listFamilies(supabase, { includeInactive: true }),
    auth.getCurrentUserWithRoles(supabase),
  ]);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  return (
    <>
      <PageHeader title="Families" breadcrumb={["NGC ERP"]} />
      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <FamiliesTable rows={rows} />
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Add a family</CardTitle>
            </CardHeader>
            <FamilyForm action={createFamilyAction} submitLabel="Add family" pendingLabel="Adding…" />
          </Card>
        )}
      </div>
    </>
  );
}
