import { useQuery } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { members } from "@ngc/services";
import { Card } from "../../../src/components/Card";
import { useAuth } from "../../../src/auth/AuthProvider";
import { getSupabaseClient } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/theme/useTheme";

type Mode = "mine" | "scan";

/**
 * "Member ID card (identity display, not raw auth)" — ARCHITECTURE.md
 * S13's first named QR use case, and the only one this V1 mobile phase
 * builds. `members.qr_token` (0004: `default gen_random_uuid() unique`) is
 * an opaque, permanent, record-bound reference — it encodes nothing about
 * the member beyond an unguessable pointer, resolved server-side by
 * `members.getMemberByQrToken` exactly like any other member read
 * (`members_select_scoped` RLS, unchanged, no new permission). Asset tags,
 * Gate Passes, and Event check-in QR codes already have the same
 * `qr_token` column (0008/0010/0011) but are deliberately NOT wired into
 * this screen — those are operations/security-desk workflows, not member
 * self-service, and out of this sub-phase's scope (see docs/PHASE_12_3.md).
 */
export default function QrScreen() {
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("mine");

  return (
    <View style={{ flex: 1, backgroundColor: colors.pagePlane }}>
      <View style={{ flexDirection: "row", padding: spacing.lg, gap: spacing.sm }}>
        {(["mine", "scan"] as Mode[]).map((m) => {
          const selected = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.sm,
                alignItems: "center",
                backgroundColor: selected ? colors.brandPrimary700 : colors.surfaceRaised,
                borderWidth: 1,
                borderColor: selected ? colors.brandPrimary700 : colors.gridline,
              }}
            >
              <Text style={{ color: selected ? "#fff" : colors.textSecondary, fontWeight: "600", fontSize: 13 }}>
                {m === "mine" ? "My ID" : "Scan"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === "mine" ? <MyIdCard memberId={user?.member?.id ?? null} /> : <ScanMemberId />}
    </View>
  );
}

function MyIdCard({ memberId }: { memberId: string | null }) {
  const { colors, spacing, radius } = useTheme();

  const query = useQuery({
    queryKey: ["members", "detail", memberId],
    queryFn: () => members.getMember(getSupabaseClient(), memberId!),
    enabled: Boolean(memberId),
  });

  if (!memberId) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>No member profile is linked to your account.</Text>
      </View>
    );
  }

  const detail = query.data;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, alignItems: "center" }}>
      <Card style={{ alignItems: "center", padding: spacing.xl }}>
        {detail ? (
          <>
            <QRCode value={detail.qrToken} size={220} color={colors.textPrimary} backgroundColor={colors.surfaceRaised} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.lg }}>
              {detail.preferredName ?? detail.firstName} {detail.lastName}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: spacing.xs }}>{detail.memberNumber}</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: spacing.xs, textAlign: "center" }}>
              Show this code — it identifies you only; it carries no personal data itself.
            </Text>
          </>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{query.isLoading ? "Loading…" : "Could not load your ID."}</Text>
        )}
      </Card>
    </ScrollView>
  );
}

function ScanMemberId() {
  const { colors, spacing, radius } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<members.MemberSummary | null | "not_found">(null);

  async function handleScan(token: string) {
    if (scannedToken) return; // already showing a result; require an explicit "Scan again" first
    setScannedToken(token);
    setResolving(true);
    try {
      const detail = await members.getMemberByQrToken(getSupabaseClient(), token);
      setResult(detail ?? "not_found");
    } catch {
      setResult("not_found");
    } finally {
      setResolving(false);
    }
  }

  function scanAgain() {
    setScannedToken(null);
    setResult(null);
  }

  if (!permission) {
    return <View style={{ flex: 1 }} />;
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, padding: spacing.lg, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center" }}>
          Camera access is needed to scan a member ID QR code.
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{ backgroundColor: colors.brandPrimary700, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Grant camera access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {!scannedToken ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={(scan) => handleScan(scan.data)}
        />
      ) : (
        <View style={{ flex: 1, padding: spacing.lg, justifyContent: "center" }}>
          <Card>
            {resolving ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Looking up…</Text>
            ) : result === "not_found" || result === null ? (
              <Text style={{ color: colors.statusCritical, fontSize: 14 }}>Not a recognized NGC member ID, or you don't have access to view this member.</Text>
            ) : (
              <>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                  {result.preferredName ?? result.firstName} {result.lastName}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: spacing.xs }}>{result.memberNumber}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs }}>
                  {result.primaryDepartmentName ?? "No department"} · {result.membershipStatus}
                </Text>
              </>
            )}
            <Pressable
              onPress={scanAgain}
              style={{
                marginTop: spacing.lg,
                backgroundColor: colors.brandPrimary700,
                borderRadius: radius.sm,
                paddingVertical: spacing.sm,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Scan again</Text>
            </Pressable>
          </Card>
        </View>
      )}
    </View>
  );
}
