import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { notifications } from "@ngc/services";
import { Card } from "../../src/components/Card";
import { useAuth } from "../../src/auth/AuthProvider";
import { getSupabaseClient } from "../../src/lib/supabase";
import { useTheme } from "../../src/theme/useTheme";

/**
 * `listMyNotifications`/`markNotificationRead` are the explicit self-scoped
 * pair (not the manage-permission-gated composer/broadcast side of this
 * module — see notifications/list.ts's own doc comments) — the correct
 * pairing for a member's own inbox. Tapping an unread notification marks it
 * read; there is no per-notification detail screen since `body` already
 * carries the full message.
 */
export default function NotificationsScreen() {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["notifications", "mine", user?.id],
    queryFn: () => notifications.listMyNotifications(getSupabaseClient(), user!.id),
    enabled: Boolean(user),
  });

  async function markRead(id: string) {
    await notifications.markNotificationRead(getSupabaseClient(), id);
    queryClient.invalidateQueries({ queryKey: ["notifications", "mine", user?.id] });
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.pagePlane }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={listQuery.isFetching} onRefresh={() => listQuery.refetch()} />}
      data={listQuery.data ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        !listQuery.isLoading ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>No notifications yet.</Text> : null
      }
      renderItem={({ item }) => {
        const unread = item.status !== "read";
        return (
          <Pressable onPress={() => (unread ? markRead(item.id) : undefined)}>
            <Card
              style={{
                marginBottom: spacing.sm,
                borderColor: unread ? colors.brandPrimary700 : colors.gridline,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ fontSize: 14, fontWeight: unread ? "700" : "400", color: colors.textPrimary, flex: 1 }}>
                  {item.subject ?? "Notification"}
                </Text>
                {unread && (
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary700, marginLeft: spacing.sm }}
                  />
                )}
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs }}>{item.body}</Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: spacing.xs }}>{item.createdAt.slice(0, 10)}</Text>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}
