import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import { useTheme } from "../../src/theme/useTheme";

/**
 * Falls back to the production URL if unset rather than throwing (unlike
 * `getSupabaseClient()`'s Supabase URL/key) — this is a public marketing/
 * app URL, not a secret, so a missing env var during local dev shouldn't
 * block every screen that links out to the web app.
 */
const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? "https://ngc.co.tz";

export default function LoginScreen() {
  const { colors, spacing, radius } = useTheme();
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      // `error` from useAuth() already carries the message; nothing further
      // to do here besides letting the button re-enable.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pagePlane, justifyContent: "center", padding: spacing.xl }}>
      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs }}>NGC ERP</Text>
      <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xl }}>Sign in with your member account.</Text>

      <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>Email</Text>
      <TextInput
        accessibilityLabel="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: colors.gridline,
          borderRadius: radius.sm,
          padding: spacing.md,
          marginBottom: spacing.md,
          color: colors.textPrimary,
          backgroundColor: colors.surfaceRaised,
        }}
      />

      <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs }}>Password</Text>
      <TextInput
        accessibilityLabel="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: colors.gridline,
          borderRadius: radius.sm,
          padding: spacing.md,
          marginBottom: spacing.lg,
          color: colors.textPrimary,
          backgroundColor: colors.surfaceRaised,
        }}
      />

      {error && <Text style={{ color: colors.statusCritical, marginBottom: spacing.md }}>{error}</Text>}

      <Pressable
        accessibilityRole="button"
        disabled={submitting}
        onPress={handleSubmit}
        style={{
          backgroundColor: colors.brandPrimary700,
          borderRadius: radius.sm,
          padding: spacing.md,
          alignItems: "center",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>Sign in</Text>}
      </Pressable>

      {/*
        An applicant mid-onboarding has no Supabase Auth session at all
        (applications.access_token_hash-based access — see
        packages/services/src/applications/token.ts's own doc comment) and
        that credential-verification path can only run through a
        service-role Supabase client, which this native app must never
        hold (it would ship a full-database-bypass secret inside a
        decompilable app bundle). Rather than reimplement that boundary
        natively, this links out to the same web page apps/web already
        serves it through (a Next.js Server Action holding the real
        service-role client) — named explicitly, not silently skipped;
        see docs/PHASE_12_3.md S1.
      */}
      <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`${APP_URL}/join/continue`)} style={{ marginTop: spacing.lg, alignItems: "center" }}>
        <Text style={{ color: colors.brandPrimary700, fontSize: 13 }}>Already applied? Check your application status</Text>
      </Pressable>
    </View>
  );
}
