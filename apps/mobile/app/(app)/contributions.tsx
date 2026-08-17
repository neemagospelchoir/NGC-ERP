import { useQuery } from "@tanstack/react-query";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { contributions } from "@ngc/services";
import { Card } from "../../src/components/Card";
import { useAuth } from "../../src/auth/AuthProvider";
import { getSupabaseClient } from "../../src/lib/supabase";
import { useTheme } from "../../src/theme/useTheme";

const STATUS_LABELS: Record<contributions.ContributionStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  reversed: "Reversed",
};

/**
 * "Contributions (read/own)" — ARCHITECTURE.md §9's mobile V1 scope. Read-
 * only for a member: `contribution_records_write_finance` RLS (0014)
 * requires `finance.contributions.manage`, so recording a contribution is
 * never a member self-service action here or on web — a member can only
 * ever see what Finance has already recorded against them, matching this
 * screen's own scope name exactly (no "make a contribution" form).
 */
export default function ContributionsScreen() {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();

  const myContributionsQuery = useQuery({
    queryKey: ["contributions", "mine", user?.member?.id],
    queryFn: () => contributions.listContributionsForMember(getSupabaseClient(), user!.member!.id),
    enabled: Boolean(user?.member),
  });

  const campaignsQuery = useQuery({
    queryKey: ["contributions", "campaigns"],
    queryFn: () => contributions.listCampaigns(getSupabaseClient()),
  });

  const campaignsById = new Map((campaignsQuery.data ?? []).map((c) => [c.id, c]));
  const activeCampaigns = (campaignsQuery.data ?? []).filter((c) => c.status === "active");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pagePlane }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={myContributionsQuery.isFetching || campaignsQuery.isFetching}
          onRefresh={() => {
            myContributionsQuery.refetch();
            campaignsQuery.refetch();
          }}
        />
      }
    >
      {activeCampaigns.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary }}>Active campaigns</Text>
          {activeCampaigns.map((campaign) => (
            <Card key={campaign.id}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>{campaign.name}</Text>
              {campaign.deadline && <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Deadline: {campaign.deadline}</Text>}
              {campaign.targetAmount != null && (
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs }}>
                  Target: {campaign.currency} {campaign.targetAmount.toLocaleString()}
                </Text>
              )}
            </Card>
          ))}
        </View>
      )}

      <View style={{ gap: spacing.sm }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textPrimary }}>My contributions</Text>
        {(myContributionsQuery.data ?? []).length === 0 && !myContributionsQuery.isLoading && (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>No contributions recorded yet.</Text>
        )}
        {(myContributionsQuery.data ?? []).map((record) => (
          <Card key={record.id} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>
                {record.currency} {record.amount.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 12, color: record.status === "reversed" ? colors.statusCritical : colors.statusGood }}>
                {STATUS_LABELS[record.status]}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: spacing.xs }}>
              {campaignsById.get(record.campaignId)?.name ?? "Campaign"} · {record.contributedAt.slice(0, 10)}
            </Text>
            {record.paymentMethod && <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{record.paymentMethod}</Text>}
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
