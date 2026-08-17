import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, itineraries, trips } from "@ngc/services";
import { Card, CardHeader, CardTitle, PageHeader } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { generateItineraryAction, updateItineraryAction, updateTripAction } from "../actions";
import { TripForm } from "../trip-form";
import { ItineraryForm } from "../itinerary-form";

export const metadata: Metadata = { title: "Trip — NGC ERP" };

const MANAGE_PERMISSION = "logistics.trips.manage";

export default async function TripDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const trip = await trips.getTrip(supabase, params.id);
  if (!trip) notFound();

  const itinerary = await itineraries.getItineraryForTrip(supabase, trip.id);

  const boundUpdateTrip = updateTripAction.bind(null, trip.id);
  const boundGenerateItinerary = generateItineraryAction.bind(null, trip.id);
  const boundUpdateItinerary = itinerary ? updateItineraryAction.bind(null, trip.id, itinerary.id) : undefined;

  return (
    <>
      <PageHeader title={trip.destination ?? "Trip"} breadcrumb={["NGC ERP", "Trips"]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Event</dt>
                <dd className="text-sm text-ink-primary">
                  <Link href={`/events/${trip.eventId}`} className="font-medium text-brand-700 hover:underline">
                    View event →
                  </Link>
                </dd>
              </div>
            </dl>
            {canManage ? (
              <TripForm action={boundUpdateTrip} trip={trip} submitLabel="Save changes" pendingLabel="Saving…" />
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ReadOnlyField label="Destination" value={trip.destination} />
                <ReadOnlyField label="Vehicle requirement" value={trip.vehicleRequirement} />
                <ReadOnlyField label="Driver" value={trip.driverName} />
                <ReadOnlyField label="Departure" value={trip.departureAt ? new Date(trip.departureAt).toLocaleString() : null} />
                <ReadOnlyField label="Arrival" value={trip.arrivalAt ? new Date(trip.arrivalAt).toLocaleString() : null} />
                <ReadOnlyField
                  label="Estimated cost"
                  value={trip.estimatedCost !== null ? `${trip.estimatedCost.toLocaleString()} ${trip.currency}` : null}
                />
                <ReadOnlyField label="Notes" value={trip.notes} />
              </dl>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Itinerary</CardTitle>
            </CardHeader>
            {itinerary ? (
              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Assigned members</dt>
                    <dd className="text-sm text-ink-primary">
                      {itinerary.assignedMemberIds.length > 0 ? itinerary.assignedMemberIds.join(", ") : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Generated</dt>
                    <dd className="text-sm text-ink-primary">{new Date(itinerary.generatedAt).toLocaleString()}</dd>
                  </div>
                </dl>
                {canManage && boundUpdateItinerary && (
                  <ItineraryForm action={boundUpdateItinerary} itinerary={itinerary} submitLabel="Save itinerary" pendingLabel="Saving…" />
                )}
              </div>
            ) : canManage ? (
              <div>
                <p className="mb-3 text-sm text-ink-secondary">No itinerary generated yet for this trip.</p>
                <ItineraryForm action={boundGenerateItinerary} submitLabel="Generate itinerary" pendingLabel="Generating…" />
              </div>
            ) : (
              <p className="text-sm text-ink-secondary">No itinerary generated yet for this trip.</p>
            )}
          </Card>
        </div>
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
