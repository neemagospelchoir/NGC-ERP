import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { attendance } from "@ngc/services";
import { Card } from "../../../src/components/Card";
import { useAuth } from "../../../src/auth/AuthProvider";
import { attendanceQueue, flushAttendanceQueue } from "../../../src/lib/attendance-queue";
import { getSupabaseClient } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/theme/useTheme";

const MANAGE_PERMISSION = "attendance.records.manage";

/**
 * `canManage` mirrors apps/web's own identical client-side gate
 * (apps/web/app/(erp)/attendance/page.tsx) — a "take attendance" affordance
 * is shown to anyone holding the manage permission OR any department-
 * scoped role (a department leader), matching who `attendance_write_scoped`
 * RLS (0006) actually lets write. This is a UX gate only, same as web's;
 * RLS is what actually enforces it either way.
 */
function useCanManageAttendance() {
  const { user } = useAuth();
  return Boolean(user?.permissionCodes.includes(MANAGE_PERMISSION) || user?.roles.some((r) => r.scopeType === "department"));
}

export default function AttendanceIndexScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();
  const canManage = useCanManageAttendance();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  const summaryQuery = useQuery({
    queryKey: ["attendance", "my-summary", user?.member?.id],
    queryFn: () => attendance.getMemberAttendanceSummary(getSupabaseClient(), user!.member!.id),
    enabled: Boolean(user?.member),
  });

  const sessionsQuery = useQuery({
    queryKey: ["attendance", "sessions"],
    queryFn: () => attendance.listSessions(getSupabaseClient()),
    enabled: canManage,
  });

  async function refreshQueueCount() {
    const queue = await attendanceQueue.getQueue();
    setPendingCount(queue.length);
  }

  useEffect(() => {
    refreshQueueCount();
    flushAttendanceQueue()
      .then(refreshQueueCount)
      .catch(() => {
        // Most commonly "still offline" — refreshAttendanceQueue's count
        // above already reflects whatever remains queued either way.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.pagePlane }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={summaryQuery.isFetching || sessionsQuery.isFetching}
          onRefresh={() => {
            summaryQuery.refetch();
            if (canManage) sessionsQuery.refetch();
          }}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          {user?.member ? (
            <Card>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>My attendance</Text>
              <Text style={{ fontSize: 28, fontWeight: "700", color: colors.textPrimary }}>
                {summaryQuery.data?.attendancePercentage === null || summaryQuery.data?.attendancePercentage === undefined
                  ? "—"
                  : `${summaryQuery.data.attendancePercentage}%`}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: spacing.xs }}>
                {summaryQuery.data ? `${summaryQuery.data.sessionsPresent} of ${summaryQuery.data.sessionsRecorded} sessions` : ""}
              </Text>
            </Card>
          ) : null}

          {pendingCount > 0 && (
            <View
              style={{
                backgroundColor: colors.brandAccent100,
                borderRadius: radius.sm,
                padding: spacing.md,
              }}
            >
              <Text style={{ color: colors.brandAccent700, fontSize: 13 }}>
                {pendingCount} attendance record{pendingCount === 1 ? "" : "s"} queued offline — will sync automatically once you're back
                online.
              </Text>
            </View>
          )}

          {canManage && <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary }}>Sessions</Text>}
        </View>
      }
      data={canManage ? sessionsQuery.data ?? [] : []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        canManage && !sessionsQuery.isLoading ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>No attendance sessions yet.</Text>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/attendance/${item.id}`)}>
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>{item.title}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              {item.sessionDate}
              {item.departmentName ? ` · ${item.departmentName}` : " · Whole choir"}
            </Text>
          </Card>
        </Pressable>
      )}
    />
  );
}
