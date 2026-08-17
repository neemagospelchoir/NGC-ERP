# PHASE_14_2.md — Phase 14.2 Deliverable
## Neema Gospel Choir (NGC) ERP — QA: CI/Test-Pipeline Hardening

Phase 14 ("QA") has no PRD-defined scope (see docs/PHASE_14_1.md's own introduction), so it continues to be decomposed into concrete, bounded sub-phases. 14.1 fixed six previously-named correctness/security gaps; this sub-phase, 14.2, closes the two CI/test-pipeline gaps 14.1 itself surfaced and named as good next candidates (docs/PHASE_14_1.md §7): the Playwright e2e suite was never wired into CI at all, and no automated database-integration test suite existed to catch a regression in an RLS policy or trigger the way 14.1's own manual `psql` verification (and its independent security review) caught two real bugs by hand. 14.3 (accessibility audit) and 14.4 (capstone regression + broader security review) continue next under this same Phase 14 authorization.

## 1. Scope

In scope:

1. **Wire the existing Playwright e2e suite into CI.** `apps/web/e2e` (77 specs across every module built since Phase 6) already ran cleanly in this sandbox via `npx playwright test`, but `.github/workflows/ci.yml` never invoked it — its own comment named the one missing piece: a `playwright install --with-deps` step, since the sandbox this suite was built in pins a pre-installed Chromium binary at a fixed local path that a GitHub Actions runner does not have.
2. **A repeatable database-integration/smoke-test suite**, automating the kind of ad hoc `psql` scenario testing this project has done by hand in nearly every phase since Phase 4 — most recently and most consequentially in Phase 14.1, where that manual process (plus an independently dispatched adversarial security review) caught two real bugs in the new workflow-bypass guard trigger before they shipped. Neither the unit tests (`packages/services`, against in-memory fixtures) nor the e2e suite (against a hand-written mock Auth/PostgREST server — see docs/AUTHENTICATION.md §4) exercises real Postgres RLS or triggers at all, so a regression in any RLS policy or trigger — including the ones 14.1 just added — would previously have gone completely uncaught by CI. `supabase/tests/smoke.sql` plus `scripts/db-smoke-test.sh` close that gap for the highest-value, newest, least-covered surface: the Phase 14.1 fixes themselves.

Explicitly not attempted this sub-phase (named here rather than silently skipped):

- **Exhaustive RLS coverage of the whole schema.** `smoke.sql` is a smoke test, not a full adversarial suite re-testing every policy on every table back to Phase 4 — those were each already verified by hand, once, as part of their own phase's validation (see every prior `docs/PHASE_*.md` §6/§4). This sub-phase targets specifically the database-layer behavior with **no other automated coverage today**: Phase 14.1's own six fixes.
- **Playwright browser caching / CI runtime optimization** (e.g. caching the installed Chromium binary across runs) — left as a real but non-blocking performance improvement, not a correctness gap.
- **A pgTAP/pg_prove-style formal test framework**, which docs/PHASE_8_3.md's own deferred-items list first floated as a possibility — `smoke.sql` uses plain `psql`/`plpgsql` `DO` blocks instead, needing no new dependency or tooling, which was judged sufficient for this suite's actual scope (see §2.2 for why).

## 2. Architecture

### 2.1 Wiring Playwright into CI

A new `e2e` job in `.github/workflows/ci.yml`, parallel to (not dependent on) `migration-check` — the e2e suite needs no real Postgres at all, since `apps/web/e2e/mock-gotrue-server.mjs` stands in for Supabase Auth/PostgREST, so it gains nothing from that job's database service and would only wait on it needlessly. It does depend on `lint-typecheck-build`, so a broken build fails fast before CI spends time installing a browser. The job: checks out, installs dependencies, runs `npx playwright install --with-deps chromium` from `apps/web` (installing exactly the one browser `playwright.config.ts`'s single `chromium` project needs, plus its OS-level dependencies a fresh Ubuntu runner won't have), builds only `@ngc/web`'s own dependency graph via `npx turbo run build --filter=@ngc/web...` (deliberately narrower than the root `pnpm build`, which would also attempt `apps/mobile`'s Expo export and require `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` this job has no reason to set), then runs `npx playwright test` from `apps/web` with the same `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`NEXT_PUBLIC_APP_URL`/`SUPABASE_SERVICE_ROLE_KEY` test values the README's own local-run instructions already use (Next.js bakes `NEXT_PUBLIC_*` values into the client bundle at build time, so the build step and the job's own env block must agree — matched exactly).

`playwright.config.ts` needed no change: its `SANDBOX_CHROMIUM_PATH` override is already guarded to only apply `if (existsSync(SANDBOX_CHROMIUM_PATH))`, so on a GitHub Actions runner (where that path doesn't exist) it's a no-op and Playwright's own default browser resolution — now actually installed — takes over.

### 2.2 The database smoke-test suite

`supabase/tests/smoke.sql` is plain SQL, not a new test framework (no pgTAP): fixtures are inserted as the `postgres` superuser (bypassing RLS, the same way every `SECURITY DEFINER` function in this schema already does), then each assertion does `set role authenticated; set app.current_user_id = '<uuid>';` to simulate one specific user's session — the exact manual pattern this project has used in every phase's own ad hoc verification — before `reset role;` returns to the superuser for the next fixture batch. Every assertion is a `DO` block: an expected-*blocked* write either raises the guard's own `SQLSTATE` (caught in a nested `BEGIN...EXCEPTION` and reported as a `NOTICE`) or is silently filtered by a bare RLS `USING` clause (checked explicitly via `GET DIAGNOSTICS ... ROW_COUNT`, since a filtered `UPDATE` affects 0 rows without raising anything) — an expected-*allowed* write is checked to have actually applied via its `RETURNING` clause. Anything that doesn't hold raises a plain `ASSERTION FAILED` exception, which — combined with `psql -v ON_ERROR_STOP=1` (the same flag `scripts/db-migrate.sh` already uses) — fails the script's exit code exactly like a migration failing to apply. This was judged sufficient without a real test framework: the suite doesn't need test discovery, fixtures-per-test isolation, or a reporting format beyond `NOTICE` lines and an exit code — a CI log is the only consumer.

Twenty-one assertions across eight scenarios, chosen specifically to cover Phase 14.1's six new fixes (the newest, least-covered surface — see §1):

- **Invitations' workflow-bypass guard (5 assertions)** — a forged direct `'approved'` write with no matching `workflow_instances` row is blocked; the legitimate sync-write succeeds once `workflow_instances` reflects `'approved'`; the exact `'declined'`/`'rejected'` vocabulary-mismatch regression 14.1's own security review caught is re-tested directly (a fresh invitation, `workflow_instances.status = 'rejected'`, must still allow `status = 'declined'`); the always-allowed `cancelInvitation` exit succeeds with no `workflow_instances` row at all; an unrecognized direct exit (neither a verified outcome nor allowlisted) is blocked — this is the "skip approval entirely via an unguarded exit" bug class.
- **Expense requests' workflow-bypass guard (3 assertions)** — same forged-approval and legitimate-sync assertions, plus a direct `pending_approval` → `paid` skip-entirely attempt (blocked, since `paid` is neither a guarded pair nor allowlisted for this table).
- **Gate passes' workflow-bypass guard (2 assertions)** — re-tests the *exact* bug 14.1's own manual testing caught: a gate pass's `person_responsible_id` (who needs no special permission at all) attempting `pending_approval` → `checked_out` directly, skipping approval entirely, must be blocked; once genuinely approved, the same person can legitimately check out.
- **Procurement's state-machine guard (3 assertions)** — `pending` → `purchased` directly (skipping `vendor_selected`) is blocked; the legal `pending` → `vendor_selected` → `purchased` path succeeds; a terminal `purchased` request cannot be resurrected to `pending`.
- **`workflow_instances` insert-only narrowing (1 assertion)** — even a `management.approvals.manage` holder's direct `UPDATE` on `workflow_instances` now affects 0 rows.
- **Playlist role-sharing (2 assertions)** — a holder of a role listed in `shared_with_roles`, who is neither a participant nor a `technical.playlists.manage` holder, can read the playlist; an outsider with none of those cannot.
- **`event_participants` read scoping (2 assertions)** — a member sees their own row; an unrelated member cannot see it.
- **Attendance `recorded_by` `WITH CHECK` (2 assertions)** — a department-scoped leader can record attendance as themself; the same leader forging `recorded_by` as someone else is blocked.

`scripts/db-smoke-test.sh` mirrors `db-migrate.sh`/`db-seed.sh`'s own conventions exactly (`set -euo pipefail`, a required `$DATABASE_URL`, `psql -v ON_ERROR_STOP=1`): it applies every migration, applies the reference seed, then runs `smoke.sql`. Wired into `migration-check`'s existing job as one more step, after a `drop schema public cascade; drop schema auth cascade; create schema ...` reset of that job's own ephemeral Postgres service container — smoke.sql's fixture inserts are meant to run against a fresh database (not one already carrying the migration-check job's own prior seed/insert side effects), and re-applying migrations here is cheap and keeps the step self-contained and independently rerunnable. `0001_extensions_and_helpers.sql`'s own `create schema if not exists auth` guard (needed for the local-dev auth shim, see docs/AUTHENTICATION.md) makes this drop-and-recreate safe to re-migrate from scratch.

## 3. UI

None. This sub-phase touches only `.github/workflows/ci.yml`, one new SQL file, and one new shell script — no application code.

## 4. Security review

This sub-phase adds no new RLS policy, trigger, or grant — it only adds test infrastructure and a CI wiring change — so the primary review question was different from every prior phase's: does this change weaken any existing gate, or leak anything, rather than does it introduce a new authorization gap. Self-reviewed directly (no new attack surface to warrant a separate adversarial dispatch, unlike 14.1's genuinely new SQL):

- The new `e2e` CI job's hardcoded env values (`test-anon-key`, `test-service-role-key`, etc.) are the same placeholder test values already used by this suite locally and documented in README.md — not real credentials, and `apps/web/e2e/mock-gotrue-server.mjs` is the only thing that ever reads them.
- The `drop schema ... cascade` step in `migration-check` only ever targets that job's own ephemeral, single-use GitHub Actions service container (a fresh Postgres 16 Docker container per job run) — never a real database, and `scripts/db-smoke-test.sh`'s own header comment states this explicitly ("Intended for a SCRATCH database only").
- `smoke.sql` performs no `ALTER`/`DROP`/`REVOKE`/`GRANT` on any real security object — only `INSERT`s of throwaway fixture rows (all `SMOKE_`-prefixed / fixed test UUIDs) and read/write assertions through normal RLS-governed DML.
- Verified the smoke suite actually catches what it claims to: manually disabled `guard_invitations_approval_status` against a scratch database and re-ran `smoke.sql` — assertion A1 failed with a clear `ASSERTION FAILED` message and a non-zero exit code, exactly as it would in CI; re-enabling the trigger restored a clean pass. This is the same "does the guard rail actually work" check 14.1's own manual testing relied on, now proven to be automated rather than assumed.
- Confirmed the `e2e` job's own scoped build (`turbo run build --filter=@ngc/web...`) does not skip any workspace dependency `@ngc/web` actually needs at build time — `packages/services`/`packages/ui`/`packages/db` have no `build` script of their own (consumed as raw TypeScript source, not a compiled `dist`), so `@ngc/web` is genuinely the only task in that filtered graph, matching what the full `pnpm build` already does for it.

No findings.

## 5. Seed data changed this phase

None.

## 6. Validation performed

- **`scripts/db-smoke-test.sh` run end-to-end against a fresh local Postgres 16 scratch database**, exactly mirroring how CI's `migration-check` job now invokes it (schema drop/recreate, re-migrate, re-seed, then the suite) — all 21 assertions pass.
- **A deliberately introduced regression**, to confirm the suite has teeth rather than trivially passing: `guard_invitations_approval_status` disabled, `smoke.sql` re-run, assertion A1 fails with a clear message and non-zero exit code; re-enabled, suite passes cleanly again.
- **`pnpm typecheck`/`pnpm lint`/`pnpm --filter @ngc/services test`** across all 8 workspace packages — clean, 458/458 unit tests passing (unaffected, as expected — no application code changed).
- **`pnpm build`** (full workspace) and **`npx turbo run build --filter=@ngc/web...`** (the exact scoped command the new `e2e` CI job uses) — both succeed.
- **The full Playwright e2e suite (77/77)**, run locally against this sandbox's pinned Chromium (the same binary `playwright.config.ts`'s `SANDBOX_CHROMIUM_PATH` guard already accounts for) — passes; one `discipline.spec.ts` test timed out on its first full-suite run under this sandbox's own resource contention (unrelated to any change in this sub-phase — discipline is untouched) and was confirmed to pass cleanly when re-run in isolation, consistent with a transient environment flake rather than a regression.
- **A local Postgres cleanup pass** — all scratch databases created during this sub-phase's validation (`ngc_erp_smoke_dev`, `ngc_erp_ci_sim`) dropped; confirmed via `pg_database` that only `postgres`/`template0`/`template1`/`ngc_erp` remain.
- **Self-review of the CI/test-infrastructure changes** for any weakened gate or leaked credential (§4) — no findings.

## 7. Open issues / deferred, not overlooked

- **Exhaustive RLS coverage remains manual, not automated** — `smoke.sql` deliberately covers only Phase 14.1's six fixes (the newest, least-covered surface), not every RLS policy back to Phase 4. Extending it further is a reasonable candidate for 14.4's capstone regression pass, but was kept out of scope here to keep this sub-phase's own diff reviewable.
- **Playwright browser install is not cached between CI runs** — a real but non-blocking runtime cost, not a correctness gap; left as a future optimization.
- Every gap named in docs/PHASE_14_1.md §7 as still open (Trips/Itineraries' broader-than-PRD read scoping, the four permission-model completeness gaps) remains open and unchanged by this sub-phase.
- Per the Development Control Rule, the remaining Phase 14 sub-phases (an accessibility audit, and a capstone regression pass + broader adversarial security review) continue next under this same Phase 14 authorization.
