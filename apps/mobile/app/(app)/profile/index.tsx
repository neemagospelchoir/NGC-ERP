import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../../src/auth/AuthProvider";
import { useTheme } from "../../../src/theme/useTheme";

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, color }}>{label}</Text>
      <Text style={{ fontSize: 15 }}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.pagePlane }} contentContainerStyle={{ padding: spacing.lg }}>
      {user?.member && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/profile/qr")}
          style={{
            backgroundColor: colors.brandPrimary700,
            borderRadius: radius.sm,
            padding: spacing.md,
            alignItems: "center",
            marginBottom: spacing.lg,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>My ID / Scan a member ID</Text>
        </Pressable>
      )}

      <View
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: radius.md,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: colors.gridline,
          marginBottom: spacing.lg,
        }}
      >
        <Row label="Name" value={user?.displayName ?? "—"} color={colors.textSecondary} />
        <Row label="Email" value={user?.email ?? "—"} color={colors.textSecondary} />
        {user?.member && (
          <>
            <Row label="Member number" value={user.member.memberNumber} color={colors.textSecondary} />
            <Row label="Membership status" value={user.member.membershipStatus} color={colors.textSecondary} />
          </>
        )}
        <Row
          label="Roles"
          value={user?.roles.length ? user.roles.map((r) => r.name).join(", ") : "None"}
          color={colors.textSecondary}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => signOut()}
        style={{
          backgroundColor: colors.surfaceRaised,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.statusCritical,
          padding: spacing.md,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.statusCritical, fontWeight: "600" }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
