import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth, families } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { updateFamilyAction, toggleFamilyActiveAction } from "../actions";
import { FamilyForm } from "../family-form";

export const metadata: Metadata = { title: "Edit family — NGC ERP" };

const MANAGE_PERMISSION = "admin.families.manage";

export default async function FamilyDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const [family, currentUser] = await Promise.all([
    families.getFamily(supabase, params.id),
    auth.getCurrentUserWithRoles(supabase),
  ]);
  if (!family) notFound();

  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const boundUpdate = updateFamilyAction.bind(null, family.id);
  const toggleActive = async () => {
    "use server";
    await toggleFamilyActiveAction(family.id, !family.isActive);
  };

  return (
    <>
      <PageHeader
        title={family.name}
        breadcrumb={["NGC ERP", "Families"]}
        action={family.isActive ? <StatusPill tone="good" label="Active" /> : <StatusPill tone="neutral" label="Inactive" />}
      />
      <div className="grid grid-cols-1 gap-6 lg:max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          {canManage ? (
            <FamilyForm
              action={boundUpdate}
              initialName={family.name}
              initialDescription={family.description}
              submitLabel="Save changes"
              pendingLabel="Saving…"
            />
          ) : (
            <p className="text-sm text-ink-primary">{family.description ?? "No description."}</p>
          )}
        </Card>
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>{family.isActive ? "Deactivate" : "Reactivate"}</CardTitle>
            </CardHeader>
            <p className="mb-3 text-sm text-ink-secondary">
              {family.isActive
                ? "Deactivating hides this family from active pickers and lists. It is never deleted — every past assignment and record stays intact."
                : "Reactivating makes this family selectable again in pickers and lists."}
            </p>
            <form action={toggleActive}>
              <Button type="submit" variant={family.isActive ? "destructive" : "primary"}>
                {family.isActive ? "Deactivate family" : "Reactivate family"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
