import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { leave } from "@ngc/services";
import { useAuth } from "../../../src/auth/AuthProvider";
import { getSupabaseClient } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/theme/useTheme";

const TYPE_LABELS: Record<leave.LeaveType, string> = {
  emergency: "Emergency",
  planned: "Planned",
  absence_explanation: "Absence explanation",
  other: "Other",
};

/**
 * Dates are plain `YYYY-MM-DD` text fields rather than a native date-picker
 * component — deliberately, to avoid pulling in a new native dependency
 * (`@react-native-community/datetimepicker`) for a V1 form. Flagged as an
 * open item in docs/PHASE_12_2.md rather than silently shipped as if it
 * were the intended long-term UX.
 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function NewLeaveRequestScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [leaveType, setLeaveType] = useState<leave.LeaveType>("planned");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    if (!user?.member) {
      setError("No member profile is linked to your account.");
      return;
    }
    if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
      setError("Dates must be in YYYY-MM-DD format.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }

    setSubmitting(true);
    try {
      await leave.createLeaveRequest(getSupabaseClient(), {
        memberId: user.member.id,
        leaveType,
        reason: reason.trim(),
        startDate,
        endDate,
      });
      await queryClient.invalidateQueries({ queryKey: ["leave", "my-requests", user.member.id] });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the leave request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.pagePlane }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Type</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
        {(Object.keys(TYPE_LABELS) as leave.LeaveType[]).map((type) => {
          const selected = leaveType === type;
          return (
            <Pressable
              key={type}
              onPress={() => setLeaveType(type)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: selected ? colors.brandPrimary700 : colors.surfaceRaised,
                borderWidth: 1,
                borderColor: selected ? colors.brandPrimary700 : colors.gridline,
              }}
            >
              <Text style={{ fontSize: 12, color: selected ? "#fff" : colors.textSecondary }}>{TYPE_LABELS[type]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Start date</Text>
      <TextInput
        value={startDate}
        onChangeText={setStartDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textMuted}
        style={inputStyle(colors, radius, spacing)}
      />

      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>End date</Text>
      <TextInput
        value={endDate}
        onChangeText={setEndDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textMuted}
        style={inputStyle(colors, radius, spacing)}
      />

      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>Reason</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Briefly explain the reason for this leave request"
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={4}
        style={[inputStyle(colors, radius, spacing), { minHeight: 96, textAlignVertical: "top" }]}
      />

      {error && <Text style={{ color: colors.statusCritical, fontSize: 13 }}>{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={submitting}
        style={{
          backgroundColor: colors.brandPrimary700,
          borderRadius: radius.sm,
          paddingVertical: spacing.md,
          alignItems: "center",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>{submitting ? "Submitting…" : "Submit request"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function inputStyle(colors: ReturnType<typeof useTheme>["colors"], radius: ReturnType<typeof useTheme>["radius"], spacing: ReturnType<typeof useTheme>["spacing"]) {
  return {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.gridline,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
  } as const;
}
