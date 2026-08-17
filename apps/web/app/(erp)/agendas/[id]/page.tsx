import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { agendas, auth } from "@ngc/services";
import { Button, Card, CardHeader, CardTitle, PageHeader, StatTile, StatusPill } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { castVoteAction, setAgendaStatusAction, updateAgendaAction } from "../actions";
import { AgendaForm } from "../agenda-form";
import { VoteForm } from "../vote-form";
import { NEXT_STATUSES, choiceLabel, eligibleVoterScopeLabel, statusLabel, statusTone } from "../status";

export const metadata: Metadata = { title: "Agenda item — NGC ERP" };

const MANAGE_PERMISSION = "management.agenda.manage";

/**
 * Two independent read paths, deliberately kept separate:
 *  - The agenda ROW and its aggregate `agenda_results` tally are always
 *    readable by any signed-in user (`agendas_select_authenticated`,
 *    0017) — the tally is never what "anonymous" is meant to hide.
 *  - Individual ballots (`agendas.listVotesForAgenda`) are only ever
 *    fetched here when `canManage && !agenda.isAnonymous` — matching
 *    exactly what `votes_select_own_or_admin` RLS (tightened by 0034)
 *    actually returns to a `management.agenda.manage` holder. Fetching it
 *    unconditionally for an anonymous agenda would just come back empty
 *    (RLS-filtered), which would read as a bug rather than the deliberate
 *    protection it is — so the page never even asks.
 */
export default async function AgendaDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const currentUser = await auth.getCurrentUserWithRoles(supabase);
  const canManage = Boolean(currentUser?.permissionCodes.includes(MANAGE_PERMISSION));

  const agenda = await agendas.getAgenda(supabase, params.id);
  if (!agenda) notFound();

  const [results, myVote, ballots] = await Promise.all([
    agendas.getAgendaResults(supabase, agenda.id),
    currentUser ? agendas.getMyVote(supabase, agenda.id, currentUser.id) : Promise.resolve(null),
    canManage && !agenda.isAnonymous ? agendas.listVotesForAgenda(supabase, agenda.id) : Promise.resolve([]),
  ]);

  const boundUpdate = updateAgendaAction.bind(null, agenda.id);
  const boundVote = castVoteAction.bind(null, agenda.id);
  const nextStatuses = NEXT_STATUSES[agenda.status];
  const isTerminal = agenda.status === "closed" || agenda.status === "cancelled";
  const votingOpen = agenda.status === "open" && new Date(agenda.votingDeadline).getTime() > Date.now();

  return (
    <>
      <PageHeader
        title={agenda.title}
        breadcrumb={["NGC ERP", "Agenda & Voting"]}
        action={<StatusPill tone={statusTone(agenda.status)} label={statusLabel(agenda.status)} />}
      />

      {results && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Yes" value={String(results.yesCount)} />
          <StatTile label="No" value={String(results.noCount)} />
          <StatTile label="Abstain" value={String(results.abstainCount)} />
          <StatTile label="Total votes" value={String(results.totalVotes)} />
        </div>
      )}

      <div className={canManage ? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]" : ""}>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            {canManage && !isTerminal ? (
              <AgendaForm action={boundUpdate} initial={agenda} submitLabel="Save changes" pendingLabel="Saving…" />
            ) : (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Description</dt>
                  <dd className="text-sm text-ink-primary">{agenda.description ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Who can vote</dt>
                  <dd className="text-sm text-ink-primary">{eligibleVoterScopeLabel(agenda.eligibleVoterScope)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Voting deadline</dt>
                  <dd className="text-sm text-ink-primary">{new Date(agenda.votingDeadline).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Anonymous</dt>
                  <dd className="text-sm text-ink-primary">{agenda.isAnonymous ? "Yes — individual ballots are never shown" : "No"}</dd>
                </div>
                {isTerminal && canManage && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Editing</dt>
                    <dd className="text-sm text-ink-primary">A {statusLabel(agenda.status).toLowerCase()} agenda item can no longer be edited.</dd>
                  </div>
                )}
              </dl>
            )}
          </Card>

          {canManage && !agenda.isAnonymous && (
            <Card>
              <CardHeader>
                <CardTitle>Individual ballots</CardTitle>
              </CardHeader>
              {ballots.length === 0 ? (
                <p className="text-sm text-ink-secondary">No votes cast yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {ballots.map((b) => (
                    <li key={b.id} className="flex items-center justify-between border-b border-hairline pb-2 text-sm last:border-0 last:pb-0">
                      <span className="text-ink-primary">{b.voterId}</span>
                      <span className="text-ink-secondary">
                        {choiceLabel(b.choice)} · {new Date(b.castAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {currentUser && (
            <Card>
              <CardHeader>
                <CardTitle>Your vote</CardTitle>
              </CardHeader>
              {myVote ? (
                <p className="text-sm text-ink-primary">
                  You voted <strong>{choiceLabel(myVote.choice)}</strong> on {new Date(myVote.castAt).toLocaleString()}. A vote cannot be changed once cast.
                </p>
              ) : votingOpen ? (
                <VoteForm votingMethod={agenda.votingMethod} action={boundVote} />
              ) : (
                <p className="text-sm text-ink-secondary">
                  {isTerminal
                    ? "Voting is no longer open for this agenda item."
                    : "Voting has not opened, or the deadline has passed."}
                </p>
              )}
              <p className="mt-3 text-xs text-ink-muted">
                If you are not eligible to vote on this item, casting a vote will be refused when you submit — eligibility is
                checked at the database level, not just shown here.
              </p>
            </Card>
          )}

          {canManage && nextStatuses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <p className="mb-3 text-sm text-ink-secondary">An agenda item moves forward only — closed and cancelled are permanent.</p>
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map((next) => {
                  const changeStatus = async () => {
                    "use server";
                    await setAgendaStatusAction(agenda.id, next);
                  };
                  return (
                    <form key={next} action={changeStatus}>
                      <Button type="submit" variant={next === "cancelled" ? "destructive" : "secondary"} size="sm">
                        Mark {statusLabel(next)}
                      </Button>
                    </form>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
