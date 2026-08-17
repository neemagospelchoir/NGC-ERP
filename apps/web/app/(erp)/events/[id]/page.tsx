import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, events } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { eventStatusLabel, eventStatusTone } from "../status";

export const metadata: Metadata = { title: "Event — NGC ERP" };

const READ_PERMISSIONS = ["events.invitations.read", "events.invitations.manage", "technical.events.manage"];

export default async function EventDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canRead = Boolean(currentUser && READ_PERMISSIONS.some((p) => currentUser.permissionCodes.includes(p)));

  if (!canRead) {
    return (
      <>
        <PageHeader title="Event" breadcrumb={["NGC ERP", "Events"]} />
        <Card>
          <p className="text-sm text-ink-secondary">You don&apos;t have permission to view events.</p>
        </Card>
      </>
    );
  }

  const event = await events.getEvent(supabase, params.id);
  if (!event) notFound();

  return (
    <>
      <PageHeader
        title={event.name}
        breadcrumb={["NGC ERP", "Events"]}
        action={<StatusPill tone={eventStatusTone(event.status)} label={eventStatusLabel(event.status)} />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Category</dt>
            <dd className="text-sm text-ink-primary">{event.eventCategory.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Date</dt>
            <dd className="text-sm text-ink-primary">{new Date(event.eventDate).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Venue</dt>
            <dd className="text-sm text-ink-primary">{event.venue ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Location</dt>
            <dd className="text-sm text-ink-primary">{event.location ?? "—"}</dd>
          </div>
        </dl>
        {event.invitationId && (
          <p className="mt-4 text-sm">
            <Link href={`/invitations`} className="font-medium text-brand-700 hover:underline">
              ← Back to invitations
            </Link>
          </p>
        )}
      </Card>
    </>
  );
}
