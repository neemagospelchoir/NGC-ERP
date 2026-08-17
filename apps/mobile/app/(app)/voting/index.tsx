import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { agendas } from "@ngc/services";
import { Card } from "../../../src/components/Card";
import { getSupabaseClient } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/theme/useTheme";

const STATUS_LABELS: Record<agendas.AgendaStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
};

/**
 * `agendas_select_authenticated` RLS (0017) lets any signed-in user read
 * every agenda row — only individual ballots are access-controlled — so
 * this list, like web's own, shows every agenda item regardless of this
 * caller's own voting eligibility for it (checked at submit time instead,
 * exactly like web — see [id].tsx's own note).
 */
export default function VotingIndexScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const query = useQuery({
    queryKey: ["agendas", "list"],
    queryFn: () => agendas.listAgendas(getSupabaseClient()),
  });

  function statusColor(status: agendas.AgendaStatus) {
    if (status === "open") return colors.statusGood;
    if (status === "cancelled") return colors.statusCritical;
    return colors.textMuted;
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.pagePlane }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} />}
      data={query.data ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={!query.isLoading ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>No agenda items yet.</Text> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/voting/${item.id}`)}>
          <Card style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary, flex: 1 }}>{item.title}</Text>
              <Text style={{ fontSize: 11, fontWeight: "600", color: statusColor(item.status) }}>{STATUS_LABELS[item.status]}</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: spacing.xs }}>
              Deadline: {new Date(item.votingDeadline).toLocaleDateString()}
            </Text>
          </Card>
        </Pressable>
      )}
    />
  );
}
