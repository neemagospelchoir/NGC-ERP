import type { Metadata } from "next";
import { auth } from "@ngc/services";
import { Badge, Card, CardHeader, CardTitle, PageHeader, StatTile } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard — NGC ERP",
};

/**
 * Placeholder gated dashboard — proves the full auth stack end-to-end
 * (middleware → layout → this page all resolving the same signed-in user)
 * ahead of Phase 7, which replaces this with the real Members/Attendance/
 * Announcements dashboard widgets. Intentionally minimal: rendering the
 * signed-in user's own roles/permissions here is itself a useful
 * "why can't I see X" debugging view for admins during Phase 7-16.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  // Layout already redirects if this is null; re-fetching here (rather than
  // passing user down via a context) keeps this page independently correct
  // if it's ever rendered outside this layout (e.g. a future parallel route).
  const user = await auth.getCurrentUserWithRoles(supabase);

  return (
    <>
      <PageHeader title="Dashboard" breadcrumb={["NGC ERP"]} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Signed in as" value={user?.displayName ?? "Unknown"} />
        <StatTile label="Active roles" value={String(user?.roles.length ?? 0)} />
        <StatTile label="Granted permissions" value={String(user?.permissionCodes.length ?? 0)} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Your roles</CardTitle>
        </CardHeader>
        {user && user.roles.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <li key={`${role.code}-${role.scopeId ?? "global"}`}>
                <Badge>
                  {role.name}
                  {role.scopeType ? ` (${role.scopeType})` : ""}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-secondary">
            No roles are assigned to your account yet. Contact an administrator.
          </p>
        )}
      </Card>
    </>
  );
}
