import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { attendance } from "@ngc/services";
import { Card } from "../../../src/components/Card";
import { useAuth } from "../../../src/auth/AuthProvider";
import { attendanceQueue, flushAttendanceQueue } from "../../../src/lib/attendance-queue";
import { getSupabaseClient } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/theme/useTheme";

/**
 * The offline-capable "take attendance" screen (ARCHITECTURE.md S18).
 * Tapping a status is deliberately OFFLINE-FIRST, not "try online, fall
 * back to queue on failure": every tap writes to the local queue FIRST
 * (attendanceQueue.enqueue, durable in AsyncStorage) and only THEN attempts
 * an immediate flush — so a record is never at risk of being lost to an app
 * crash or kill between the tap and a slow/failed network call. The
 * `pendingByMember`/`conflictsByMember` local state exists because the
 * roster query below reflects SERVER state only; a just-queued-but-not-
 * yet-synced tap needs its own optimistic overlay so the UI doesn't look
 * like the tap did nothing while offline.
 */
export default function AttendanceRosterScreen() {
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [pendingByMember, setPendingByMember] = useState<Record<string, string>>({});
  const [conflictsByMember, setConflictsByMember] = useState<Record<string, string>>({});

  const sessionQuery = useQuery({
    queryKey: ["attendance", "session", sessionId],
    queryFn: () => attendance.getSession(getSupabaseClient(), sessionId),
  });
  const rosterQuery = useQuery({
    queryKey: ["attendance", "roster", sessionId],
    queryFn: () => attendance.getSessionRoster(getSupabaseClient(), sessionId),
  });
  const statusesQuery = useQuery({
    queryKey: ["attendance", "statuses"],
    queryFn: () => attendance.listAttendanceStatuses(getSupabaseClient()),
    staleTime: 5 * 60_000, // admin-configurable, but not something that changes mid-session
  });

  async function recordStatus(memberId: string, statusCode: string) {
    if (!user) return;
    setPendingByMember((prev) => ({ ...prev, [memberId]: statusCode }));
    setConflictsByMember((prev) => {
      const next = { ...prev };
      delete next[memberId];
      return next;
    });

    await attendanceQueue.enqueue(
      { sessionId, memberId, statusCode, notes: null, recordedBy: user.id },
      new Date().toISOString()
    );

    const outcome = await flushAttendanceQueue();

    for (const record of outcome.synced) {
      if (record.sessionId === sessionId) {
        setPendingByMember((prev) => {
          const next = { ...prev };
          delete next[record.memberId];
          return next;
        });
      }
    }
    for (const { record, existing } of outcome.conflicts) {
      if (record.sessionId === sessionId) {
        setPendingByMember((prev) => {
          const next = { ...prev };
          delete next[record.memberId];
          return next;
        });
        setConflictsByMember((prev) => ({ ...prev, [record.memberId]: existing.statusCode }));
      }
    }

    if (outcome.synced.some((r) => r.sessionId === sessionId)) {
      queryClient.invalidateQueries({ queryKey: ["attendance", "roster", sessionId] });
    }
  }

  const statuses = statusesQuery.data ?? [];

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.pagePlane }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      ListHeaderComponent={
        sessionQuery.data ? (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>{sessionQuery.data.title}</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>
              {sessionQuery.data.sessionDate}
              {sessionQuery.data.departmentName ? ` · ${sessionQuery.data.departmentName}` : " · Whole choir"}
            </Text>
          </View>
        ) : null
      }
      data={rosterQuery.data ?? []}
      keyExtractor={(item) => item.memberId}
      renderItem={({ item }) => {
        const pendingStatus = pendingByMember[item.memberId];
        const conflictStatus = conflictsByMember[item.memberId];
        const effectiveStatus = pendingStatus ?? item.statusCode;

        return (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>{item.memberName}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm }}>{item.memberNumber}</Text>

            {conflictStatus && (
              <Text style={{ fontSize: 12, color: colors.statusCritical, marginBottom: spacing.xs }}>
                Sync conflict — server already has "{conflictStatus}" recorded for this member. Choose again to overwrite, or leave as is.
              </Text>
            )}
            {pendingStatus && !conflictStatus && (
              <Text style={{ fontSize: 12, color: colors.brandAccent500, marginBottom: spacing.xs }}>Syncing…</Text>
            )}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {statuses.map((s) => {
                const selected = effectiveStatus === s.code;
                return (
                  <Pressable
                    key={s.code}
                    accessibilityRole="button"
                    onPress={() => recordStatus(item.memberId, s.code)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: spacing.sm,
                      borderRadius: radius.pill,
                      backgroundColor: selected ? colors.brandPrimary700 : colors.pagePlane,
                      borderWidth: 1,
                      borderColor: selected ? colors.brandPrimary700 : colors.gridline,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: selected ? "#fff" : colors.textSecondary }}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        );
      }}
    />
  );
}
