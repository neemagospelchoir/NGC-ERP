import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { calendar, events as eventsService } from "@ngc/services";
import { Card } from "../../src/components/Card";
import { useAuth } from "../../src/auth/AuthProvider";
import { getSupabaseClient } from "../../src/lib/supabase";
import { useTheme } from "../../src/theme/useTheme";

const TYPE_LABELS: Record<calendar.CalendarItemType, string> = {
  event: "Event",
  attendance_session: "Attendance",
  contribution_deadline: "Contribution deadline",
};

function monthRange(reference: Date) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

/**
 * A read-only merged agenda for the current calendar month (ARCHITECTURE
 * S18's "Events/Calendar"). `listCalendarItems` already scopes each of its
 * three underlying sources through that source's own RLS-backed list
 * function (see calendar/list.ts's own doc comment), so a department
 * leader here sees exactly the attendance sessions their existing web
 * scope allows, unchanged.
 *
 * Only `attendance_session` items are pressable — their `href`
 * (`/attendance/:id`) matches a route this mobile app actually has. Event
 * and contribution-deadline detail screens are web-only in this phase, so
 * those rows are informational only rather than a dead-end navigation.
 * Month navigation (prev/next) is also not built in V1 — this always shows
 * the current month, flagged as an open item in docs/PHASE_12_2.md.
 *
 * "Event assignments" (ARCHITECTURE.md §9's mobile V1 list, Phase 12.3)
 * is folded into this same screen rather than given its own tab — an
 * eighth-plus tab for a single read-only list wasn't worth it (§2.4 of
 * docs/PHASE_12_2.md already named the tab bar as a V1 tradeoff); "which
 * events am I assigned to" is naturally the same screen as "what's on the
 * calendar," just filtered to this member via `event_participants`
 * (`events.listEventAssignmentsForMember`, new this sub-phase).
 */
export default function EventsScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { from, to } = useMemo(() => monthRange(new Date()), []);

  const query = useQuery({
    queryKey: ["calendar", "items", from, to],
    queryFn: () => calendar.listCalendarItems(getSupabaseClient(), { from, to }),
  });

  const assignmentsQuery = useQuery({
    queryKey: ["events", "my-assignments", user?.member?.id],
    queryFn: () => eventsService.listEventAssignmentsForMember(getSupabaseClient(), user!.member!.id),
    enabled: Boolean(user?.member),
  });

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.pagePlane }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={
        <RefreshControl
          refreshing={query.isFetching || assignmentsQuery.isFetching}
          onRefresh={() => {
            query.refetch();
            assignmentsQuery.refetch();
          }}
        />
      }
      data={query.data ?? []}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        (assignmentsQuery.data ?? []).length > 0 ? (
          <View style={{ marginBottom: spacing.md, gap: spacing.sm }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary }}>My assignments</Text>
            {assignmentsQuery.data!.map((event) => (
              <Card key={event.id} style={{ marginBottom: spacing.sm }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{event.name}</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  {event.eventDate}
                  {event.venue ? ` · ${event.venue}` : ""}
                </Text>
              </Card>
            ))}
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary, marginTop: spacing.sm }}>This month</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        !query.isLoading ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>Nothing on the calendar this month.</Text> : null
      }
      renderItem={({ item }) => {
        const pressable = item.type === "attendance_session";
        const body = (
          <Card style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary, flex: 1 }}>{item.title}</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>{item.date}</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs }}>
              {TYPE_LABELS[item.type]} · {item.subtitle}
            </Text>
          </Card>
        );
        return pressable ? <Pressable onPress={() => router.push(item.href)}>{body}</Pressable> : body;
      }}
    />
  );
}
