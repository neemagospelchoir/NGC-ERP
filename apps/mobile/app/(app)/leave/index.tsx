import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { leave } from "@ngc/services";
import { Card } from "../../../src/components/Card";
import { useAuth } from "../../../src/auth/AuthProvider";
import { getSupabaseClient } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/theme/useTheme";

type LeaveStatus = leave.LeaveStatus;

const STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/**
 * Member self-service: "my own leave requests" only. `listLeaveRequests`
 * also serves a manager/leader "everyone in scope" view (its own RLS-backed
 * `leave_requests_select_scoped`, see list.ts), but this V1 mobile screen
 * only exposes the self-service half — a leader-facing approvals queue is
 * an open item, same "web already has an approvals UI; mobile parity for
 * the manage side isn't in this sub-phase's scope" note as Attendance's
 * take-side (which mobile DOES cover) vs. session creation (which it
 * doesn't).
 */
export default function LeaveIndexScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const requestsQuery = useQuery({
    queryKey: ["leave", "my-requests", user?.member?.id],
    queryFn: () => leave.listLeaveRequests(getSupabaseClient(), { memberId: user!.member!.id }),
    enabled: Boolean(user?.member),
  });

  function statusColor(status: LeaveStatus) {
    if (status === "approved") return colors.statusGood;
    if (status === "rejected") return colors.statusCritical;
    if (status === "cancelled") return colors.textMuted;
    return colors.statusWarning;
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.pagePlane }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshControl={<RefreshControl refreshing={requestsQuery.isFetching} onRefresh={() => requestsQuery.refetch()} />}
      ListHeaderComponent={
        <Pressable
          onPress={() => router.push("/leave/new")}
          style={{
            backgroundColor: colors.brandPrimary700,
            borderRadius: radius.sm,
            paddingVertical: spacing.md,
            alignItems: "center",
            marginBottom: spacing.md,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Request leave</Text>
        </Pressable>
      }
      data={requestsQuery.data ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        !requestsQuery.isLoading ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>No leave requests yet.</Text> : null
      }
      renderItem={({ item }) => (
        <Card style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary, flex: 1 }}>
              {item.startDate}
              {item.endDate !== item.startDate ? ` – ${item.endDate}` : ""}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: statusColor(item.status) }}>{STATUS_LABELS[item.status]}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: spacing.xs }}>{item.reason}</Text>
          {item.approverComment && (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs, fontStyle: "italic" }}>
              "{item.approverComment}"
            </Text>
          )}
        </Card>
      )}
    />
  );
}
