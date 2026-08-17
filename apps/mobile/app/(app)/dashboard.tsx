import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { attendance } from "@ngc/services";
import { useAuth } from "../../src/auth/AuthProvider";
import { getSupabaseClient } from "../../src/lib/supabase";
import { useTheme } from "../../src/theme/useTheme";

/**
 * V1 dashboard: a greeting, the member's attendance summary (if they have a
 * linked member record — an Applicant/Guest-persona user may not, per
 * ARCHITECTURE's own persona list, and that is a normal, expected state,
 * not an error). Announcements/Events/Notifications tiles are 12.2 work —
 * this screen intentionally stays this small for 12.1 so Foundation can be
 * verified end-to-end (auth → shared service call → RLS-scoped read →
 * render) before building out every module's own card.
 */
export default function DashboardScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof attendance.getMemberAttendanceSummary>> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.member) return;
    attendance
      .getMemberAttendanceSummary(getSupabaseClient(), user.member.id)
      .then(setSummary)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load attendance."));
  }, [user?.member?.id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.pagePlane }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs }}>
        Welcome, {user?.displayName ?? "member"}
      </Text>
      <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg }}>
        {user?.roles.length ? user.roles.map((r) => r.name).join(", ") : "No roles assigned"}
      </Text>

      {user?.member ? (
        <View
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: radius.md,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.gridline,
          }}
        >
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>Attendance</Text>
          {loadError ? (
            <Text style={{ color: colors.statusCritical }}>{loadError}</Text>
          ) : summary ? (
            <Text style={{ fontSize: 28, fontWeight: "700", color: colors.textPrimary }}>
              {summary.attendancePercentage === null ? "—" : `${summary.attendancePercentage}%`}
            </Text>
          ) : (
            <Text style={{ color: colors.textMuted }}>Loading…</Text>
          )}
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: spacing.xs }}>
            {summary ? `${summary.sessionsPresent} of ${summary.sessionsRecorded} sessions` : ""}
          </Text>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.surfaceRaised,
            borderRadius: radius.md,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.gridline,
          }}
        >
          <Text style={{ color: colors.textSecondary }}>
            No member record is linked to your account yet — attendance, events, and other member-only features will
            appear here once one is.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
