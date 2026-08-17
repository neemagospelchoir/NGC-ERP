import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, technicalRiders } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { updateTechnicalRiderAction } from "../actions";
import { TechnicalRiderForm } from "../rider-form";

export const metadata: Metadata = { title: "Technical Rider — NGC ERP" };

const MANAGE_PERMISSION = "technical.riders.manage";

export default async function TechnicalRiderDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const rider = await technicalRiders.getTechnicalRider(supabase, params.id);
  if (!rider) notFound();

  const boundUpdate = updateTechnicalRiderAction.bind(null, rider.id, rider.eventId);

  return (
    <>
      <PageHeader title="Technical Rider" breadcrumb={["NGC ERP", "Technical Riders"]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Event</dt>
              <dd className="text-sm text-ink-primary">
                <Link href={`/events/${rider.eventId}`} className="font-medium text-brand-700 hover:underline">
                  View event →
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Prepared by</dt>
              <dd className="text-sm text-ink-primary">{rider.preparedBy ?? "—"}</dd>
            </div>
          </dl>
        </Card>

        {canManage ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Edit rider</CardTitle>
            </CardHeader>
            <TechnicalRiderForm action={boundUpdate} rider={rider} submitLabel="Save changes" pendingLabel="Saving…" />
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>PA / lighting / stage requirements</CardTitle>
            </CardHeader>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ReadOnlyField label="PA requirements" value={rider.paRequirements} />
              <ReadOnlyField label="Lighting requirements" value={rider.lightingRequirements} />
              <ReadOnlyField label="LED display requirements" value={rider.ledDisplayRequirements} />
              <ReadOnlyField label="Camera requirements" value={rider.cameraRequirements} />
              <ReadOnlyField label="Recording requirements" value={rider.recordingRequirements} />
              <ReadOnlyField label="Power requirements" value={rider.powerRequirements} />
              <ReadOnlyField label="Stage requirements" value={rider.stageRequirements} />
              <ReadOnlyField label="Monitoring requirements" value={rider.monitoringRequirements} />
              <ReadOnlyField label="Crew notes" value={rider.crewNotes} />
              <ReadOnlyField label="General technical notes" value={rider.technicalNotes} />
            </dl>
          </Card>
        )}
      </div>
    </>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-ink-primary">{value ?? "—"}</dd>
    </div>
  );
}
