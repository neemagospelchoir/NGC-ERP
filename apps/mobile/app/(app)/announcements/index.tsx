import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { announcements } from "@ngc/services";
import { Card } from "../../../src/components/Card";
import { getSupabaseClient } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/theme/useTheme";

const PRIORITY_LABELS: Record<announcements.AnnouncementPriority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

/**
 * Read-only for members — `listAnnouncements`'s own RLS
 * (`announcements_select_published`) already returns exactly "what's live
 * for me right now" for a plain member (see list.ts's own doc comment), so
 * no client-side filtering by audience/date is duplicated here. Authoring
 * (create/update/delete) is a web-only, manage-permission-gated flow not
 * ported to mobile in this sub-phase — same "not every manage-side flow
 * gets mobile parity in V1" note as Leave's approvals queue.
 */
export default function AnnouncementsIndexScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const listQuery = useQuery({
    queryKey: ["announcements", "list"],
    queryFn: () => announcements.listAnnouncements(getSupabaseClient()),
  });

  function priorityColor(priority: announcements.AnnouncementPriority) {
    if (priority === "urgent") return colors.statusCritical;
    if (priority === "high") return colors.statusSerious;
    if (priority === "low") return colors.textMuted;
    return colors.brandPrimary700;
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.pagePlane }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={listQuery.isFetching} onRefresh={() => listQuery.refetch()} />}
      data={listQuery.data ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        !listQuery.isLoading ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>No announcements right now.</Text> : null
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/announcements/${item.id}`)}>
          <Card style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary, flex: 1 }}>{item.title}</Text>
              {item.priority !== "normal" && (
                <Text style={{ fontSize: 11, fontWeight: "600", color: priorityColor(item.priority) }}>
                  {PRIORITY_LABELS[item.priority]}
                </Text>
              )}
            </View>
            <Text numberOfLines={2} style={{ fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs }}>
              {item.message}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: spacing.xs }}>{item.publishAt.slice(0, 10)}</Text>
          </Card>
        </Pressable>
      )}
    />
  );
}
