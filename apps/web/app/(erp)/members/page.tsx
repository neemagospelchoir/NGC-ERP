import type { Metadata } from "next";
import Link from "next/link";
import { auth, departments, families, members } from "@ngc/services";
import { Button, Card, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { MembersTable } from "./members-table";
import { MEMBERSHIP_STATUS_OPTIONS } from "./status";

export const metadata: Metadata = { title: "Members — NGC ERP" };

const MANAGE_PERMISSION = "members.profiles.manage";

/**
 * Filters are plain GET query params (searchParams), not client-side state
 * — every filter combination is a bookmarkable/shareable URL and the
 * filtering itself happens server-side via listMembers()'s options, which
 * is what actually scopes the RLS-governed query (see list.ts's doc
 * comment on why no app-layer permission check is needed here). The "Add
 * member" action is hidden for anyone without members.profiles.manage —
 * /members/new itself also re-checks this (defense in depth, same as the
 * detail page's canManage branch), so this is a UX nicety, not the actual
 * gate.
 */
export default async function MembersPage(
  props: {
    searchParams: Promise<{ status?: string; department?: string; family?: string; q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const [rows, departmentOptions, familyOptions, currentUser] = await Promise.all([
    members.listMembers(supabase, {
      membershipStatus: searchParams.status || undefined,
      departmentId: searchParams.department || undefined,
      familyId: searchParams.family || undefined,
      search: searchParams.q || undefined,
    }),
    departments.listDepartments(supabase),
    families.listFamilies(supabase),
    auth.getCurrentUserWithRoles(supabase),
  ]);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  return (
    <>
      <PageHeader
        title="Members"
        breadcrumb={["NGC ERP"]}
        action={
          canManage ? (
            <Link href="/members/new">
              <Button>Add member</Button>
            </Link>
          ) : undefined
        }
      />
      <Card className="mb-6">
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Search
            <input
              type="text"
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Name…"
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Status
            <select
              name="status"
              defaultValue={searchParams.status ?? ""}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            >
              <option value="">All statuses</option>
              {MEMBERSHIP_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Department
            <select
              name="department"
              defaultValue={searchParams.department ?? ""}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            >
              <option value="">All departments</option>
              {departmentOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Family
            <select
              name="family"
              defaultValue={searchParams.family ?? ""}
              className="h-10 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary"
            >
              <option value="">All families</option>
              {familyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" variant="secondary">
              Apply filters
            </Button>
          </div>
        </form>
      </Card>
      <MembersTable rows={rows} />
    </>
  );
}
