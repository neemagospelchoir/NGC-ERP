import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { agendas } from "@ngc/services";
import { Card } from "../../../src/components/Card";
import { useAuth } from "../../../src/auth/AuthProvider";
import { getSupabaseClient } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/theme/useTheme";

const CHOICE_LABELS: Record<agendas.VoteChoice, string> = { yes: "Yes", no: "No", abstain: "Abstain" };

/**
 * Mirrors apps/web's own `[id]/page.tsx` exactly: the ballot form is shown
 * to any signed-in caller whenever voting is open and they haven't voted
 * yet, with NO client-side re-derivation of `eligible_voter_scope` — the
 * same explicit choice web's page makes, and for the same reason (0034's
 * own doc comment): a client-side-only eligibility check would be theater,
 * not a boundary. `votes_insert_self` RLS is the real gate and rejects an
 * ineligible submission with a clear `ServiceError`, shown inline below.
 */
export default function AgendaDetailScreen() {
  const { id: agendaId } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agendaQuery = useQuery({ queryKey: ["agendas", "detail", agendaId], queryFn: () => agendas.getAgenda(getSupabaseClient(), agendaId) });
  const resultsQuery = useQuery({ queryKey: ["agendas", "results", agendaId], queryFn: () => agendas.getAgendaResults(getSupabaseClient(), agendaId) });
  const myVoteQuery = useQuery({
    queryKey: ["agendas", "my-vote", agendaId, user?.id],
    queryFn: () => agendas.getMyVote(getSupabaseClient(), agendaId, user!.id),
    enabled: Boolean(user),
  });

  const agenda = agendaQuery.data;
  const results = resultsQuery.data;
  const votingOpen = agenda ? agenda.status === "open" && new Date(agenda.votingDeadline).getTime() > Date.now() : false;

  async function vote(choice: agendas.VoteChoice) {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      await agendas.castVote(getSupabaseClient(), { agendaId, voterId: user.id, choice });
      queryClient.invalidateQueries({ queryKey: ["agendas", "my-vote", agendaId, user.id] });
      queryClient.invalidateQueries({ queryKey: ["agendas", "results", agendaId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record your vote.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!agenda) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.pagePlane, padding: spacing.lg }}>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{agendaQuery.isLoading ? "Loading…" : "This agenda item is not available."}</Text>
      </View>
    );
  }

  const choices: agendas.VoteChoice[] = agenda.votingMethod === "yes_no" ? ["yes", "no"] : ["yes", "no", "abstain"];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.pagePlane }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>{agenda.title}</Text>
      {agenda.description && <Text style={{ fontSize: 14, color: colors.textSecondary }}>{agenda.description}</Text>}
      <Text style={{ fontSize: 12, color: colors.textMuted }}>Deadline: {new Date(agenda.votingDeadline).toLocaleString()}</Text>

      {results && (
        <Card>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.sm }}>Current tally</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.textPrimary }}>Yes: {results.yesCount}</Text>
            <Text style={{ color: colors.textPrimary }}>No: {results.noCount}</Text>
            <Text style={{ color: colors.textPrimary }}>Abstain: {results.abstainCount}</Text>
          </View>
        </Card>
      )}

      <Card>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.sm }}>Your vote</Text>
        {myVoteQuery.data ? (
          <Text style={{ color: colors.textPrimary, fontSize: 14 }}>
            You voted <Text style={{ fontWeight: "700" }}>{CHOICE_LABELS[myVoteQuery.data.choice]}</Text> on{" "}
            {new Date(myVoteQuery.data.castAt).toLocaleString()}. A vote cannot be changed once cast.
          </Text>
        ) : votingOpen ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {choices.map((choice) => (
              <Pressable
                key={choice}
                disabled={submitting}
                onPress={() => vote(choice)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.sm,
                  alignItems: "center",
                  backgroundColor: colors.brandPrimary700,
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>{CHOICE_LABELS[choice]}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Voting has not opened, or the deadline has passed.</Text>
        )}
        {error && <Text style={{ color: colors.statusCritical, fontSize: 12, marginTop: spacing.sm }}>{error}</Text>}
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: spacing.sm }}>
          If you are not eligible to vote on this item, casting a vote will be refused when you submit — eligibility is checked at
          the database level, not just shown here.
        </Text>
      </Card>
    </ScrollView>
  );
}
