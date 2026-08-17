import type { Metadata } from "next";
import { auth, events } from "@ngc/services";
import { Card, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { EventsTable } from "./events-table";

export const metadata: Metadata = { title: "Events — NGC ERP" };

const READ_PERMISSIONS = ["events.invitations.read", "events.invitations.manage", "technical.events.manage"];

/**
 * Deliberately thin this phase: an `events` row is created automatically
 * on invitation approval (packages/services/src/events/create-from-
 * invitation.ts) and this page only reads it back. Technical Rider,
 * Playlist, Equipment assignment, Gate Pass, Logistics Itinerary, Member
 * Eligibility, and Attendance (PRD §7.9/§7.6/§7.25/§7.11/§7.26) all attach
 * to this same `events` row in later phases — see docs/PHASE_7_5.md §1.
 */
export default async function EventsPage() {
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser && READ_PERMISSIONS.some((p) => currentUser.permissionCodes.includes(p)));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Events" breadcrumb={["NGC ERP"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view events.</p>
        </Card>
      </>
    );
  }

  const rows = await events.listEvents(supabase);

  return (
    <>
      <PageHeader title="Events" breadcrumb={["NGC ERP"]} />
      <EventsTable rows={rows} />
    </>
  );
}
