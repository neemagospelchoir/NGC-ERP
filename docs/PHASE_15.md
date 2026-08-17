# PHASE_15.md — Phase 15 Deliverable

## Neema Gospel Choir (NGC) ERP — Deployment

Phase 15 is the last phase named in `ARCHITECTURE.md` §19's roadmap ("14. QA → 15. Deployment"), and — like Phase 14 — has no PRD-defined checklist of its own; `ARCHITECTURE.md` §19 names it only as a roadmap position. Unlike Phase 14, though, this same document has a concrete, actionable spec for it elsewhere: §17 "Deployment & DevOps Architecture" gives six specific bullets (environments, CI/CD, database migrations, backups, monitoring, environment variables/secrets), so this phase implements §17 point-by-point rather than requiring another user scoping decision.

A note on scope continuity, named rather than silently dropped, per this project's own established convention: Phase 14 was decomposed into 14.1 (correctness/security hardening), 14.2 (CI/test-pipeline hardening), and 14.3 (accessibility audit). A fourth sub-phase, 14.4 (a capstone regression pass plus a broader adversarial security review across all fourteen prior phases), was proposed as the natural next step after 14.3 but was never started — the user's own explicit instruction ("Proceed with phase 15") after 14.3's completion moved directly to this PHASE boundary instead, which — per this session's Development Control Rule, under which an explicit phase-boundary instruction takes precedence over a self-proposed sub-phase decomposition — is followed here without further clarification. 14.4 remains a legitimate, un-done candidate for future work if the user wants it; it was skipped by instruction, not forgotten.

This sandbox has no live Vercel, Supabase (beyond the local CLI), or Expo account connected — no domain, no production database, no app-store listing. Every piece of infrastructure this phase builds is therefore real and structurally correct (checked by YAML parsing, and where possible actually executed against a real local Postgres instance), but deliberately guarded to show as cleanly **skipped** rather than fake-succeeding, until a human operator completes the one-time setup checklist named in `docs/DEPLOYMENT.md` §6.

## 1. Scope

In scope, mapping directly onto `ARCHITECTURE.md` §17's six bullets:

1. **Environments** (§17 bullet 1) — documented in `docs/DEPLOYMENT.md` §1: local/dev, staging, production, with staging explicitly seeded `DEMO_*`-only per the architecture's own constraint.
2. **CI/CD** (§17 bullet 2) — a new `.github/workflows/deploy.yml` implementing the exact trigger rules quoted in §17 verbatim: PR-time checks were already Phase 14.2's `ci.yml`; this phase adds merge-to-`develop` → staging deploy + migration dry-run, merge-to-`main` → production migrations + web deploy + mobile OTA update, and tagged-release (`v*`) → native app-store builds.
3. **Database migrations** (§17 bullet 3) — already satisfied by the existing `supabase/migrations` convention (Phase 4 onward); this phase adds the CI wiring that actually *runs* pending migrations against production on merge to `main`, and a migration dry-run against `develop`.
4. **Backups** (§17 bullet 4) — a new `.github/workflows/backup-restore-drill.yml` implementing "backup restoration tested periodically, not just configured" (§17's own words) via two distinct drills, detailed in §2.3 below.
5. **Monitoring** (§17 bullet 5) — a new public `/api/health` endpoint (`apps/web/app/api/health/route.ts`) performing a real database round-trip, as the concrete, checkable seed of "uptime/error monitoring on both the web app and Edge Functions"; the full monitoring bullet is not fully achievable without a live account (see §7).
6. **Environment variables/secrets** (§17 bullet 6) — a full matrix in `docs/DEPLOYMENT.md` §3, distinguishing app runtime env vars (per environment) from CI-only secrets/vars the new workflows themselves need.

Also in scope: `apps/web/vercel.json` and `apps/mobile/eas.json`, the two platform-specific config files the CI/CD workflows and the mobile build profiles depend on, and `docs/DEPLOYMENT.md` itself as the single reference document tying all of the above together, including its §6 one-time manual setup checklist.

Explicitly not attempted this phase (named here rather than silently skipped):

- **Actually creating any live Vercel/Supabase/Expo account, project, or secret.** This is inherently a human/organizational action (billing, domain ownership, account credentials) that a sandboxed coding session should never perform on the user's behalf — see `docs/DEPLOYMENT.md` §6 for the full checklist of what remains.
- **Wiring an actual error-tracking SDK** (e.g. Sentry) into the web app. `ERROR_TRACKING_DSN` already exists as a named env var (from an earlier phase's `.env.example`), but no SDK reads it yet — named as an open gap in `docs/DEPLOYMENT.md` §5 rather than added speculatively without a chosen provider.
- **An uptime-monitoring integration** (e.g. a Pingdom/UptimeRobot/Better Uptime check hitting `/api/health`) — the endpoint this phase adds is the thing such a service would poll, but configuring the poller itself requires an account and is named as a manual setup step (§6).
- **14.4's capstone regression + broader security review**, per the scope-continuity note in this document's introduction.
- **Automating the "real" production-backup-restore-and-verify step end-to-end from CI**, a deliberate security decision explained in full in §2.3 below and `docs/DEPLOYMENT.md` §4.

## 2. Architecture

### 2.1 The health-check endpoint

`apps/web/app/api/health/route.ts` is a public, unauthenticated `GET` route (added to `middleware.ts`'s `PUBLIC_PATHS` allowlist) that performs a real database round-trip via the service-role client (`select("id").limit(1)` against `system_settings`), not merely a "the process is up" check — a Next.js server can be fully booted and still unable to reach its database, and only a real query distinguishes the two. It returns a small, fixed-shape JSON body (`{status, database, timestamp}` on success; `{status: "error", database: "unreachable"}` with a `503` on failure) that never leaks internals (no stack trace, no connection string, no table contents) since this route is deliberately reachable by anyone, including an unauthenticated monitoring service with no credentials of its own.

### 2.2 CI/CD pipeline (`deploy.yml`)

Six jobs, each named for the exact `develop`/`main`/tag trigger and target from §17's bullet, quoted in this file's own header comment:

- **`migration-dry-run`** (push to `develop`) — the one job with no secrets guard at all: applies every migration under `supabase/migrations`, in order, to a disposable Postgres 16 service container via the existing `scripts/db-migrate.sh`, mirroring `ci.yml`'s own `migration-check` job. Always genuinely runs.
- **`deploy-staging`** (push to `develop`, guarded on `vars.VERCEL_PROJECT_ID`/`secrets.VERCEL_TOKEN`) — deploys `apps/web` to Vercel's staging/preview environment using Vercel's documented CI recipe for a prebuilt monorepo deploy: `vercel pull` (pull environment config) → `vercel build` (build locally, so this job's own turbo-filtered build — the same one `ci.yml` already verifies — controls exactly what ships, rather than trusting Vercel's remote build step to rediscover the right workspace) → `vercel deploy --prebuilt` (upload the prebuilt output). This 3-step pattern replaced an earlier, incorrect single `vercel deploy <dir> --scope=...` draft once checked against Vercel's actual documented recipe — see Errors and fixes in this session's own history.
- **`run-production-migrations`** (push to `main`, guarded on `secrets.PRODUCTION_DATABASE_URL`) — applies pending migrations to production via the same idempotent `scripts/db-migrate.sh`.
- **`deploy-production`** (push to `main`, `needs: run-production-migrations`, guarded on `vars.VERCEL_PROJECT_ID`/`secrets.VERCEL_TOKEN`) — the same 3-step Vercel recipe with `--prod`. Uses `if: ${{ always() && ... && needs.run-production-migrations.result != 'failure' }}` rather than a plain `needs:` dependency, so a **skipped** migration job (this repo's own current state, with no `PRODUCTION_DATABASE_URL` configured yet) doesn't block the deploy job's own independent secret check, while a genuine migration **failure** still does.
- **`mobile-ota-update`** (push to `main`, same `needs`/`always()` pattern, guarded on `secrets.EXPO_TOKEN`) — runs `npx eas update --channel production --non-interactive` to push an OTA JS-bundle update to already-installed native app installs.
- **`mobile-native-release`** (tag `v*`, guarded on `secrets.EXPO_TOKEN`) — runs `npx eas build --platform all --profile production --non-interactive --no-wait`, triggering (not waiting on) a native binary build for both app stores. `eas submit` (actually publishing to the App Store/Play Store) is deliberately left as a manual, human-triggered command rather than automated on every tag — an app-store submission is a judgment call (release notes, staged rollout, compliance review) that shouldn't happen unattended on every tag push.

All five secret-guarded jobs use a job-level `if: ${{ secrets.X != '' }}` (or `vars.X != ''`) check, producing a clean **skipped** status in the Actions UI — not a false-green fake success, not a red failure — until the real secret exists, per `docs/DEPLOYMENT.md` §3's matrix and §6's checklist.

### 2.3 Backup-restore drill (`backup-restore-drill.yml`)

Two genuinely different drills, both scheduled weekly (`cron: "0 4 * * 1"`) plus `workflow_dispatch` for on-demand runs, implementing §17's "backup restoration tested periodically, not just configured":

1. **`schema-rebuild-drill`** — always runs, no secrets required. Rebuilds the entire schema from nothing (every migration under `supabase/migrations`, in order) into a disposable Postgres 16 container, then runs Phase 14.2's own `supabase/tests/smoke.sql` (21 RLS/trigger assertions across 8 scenarios) against it via `scripts/db-smoke-test.sh` — i.e. not just "did every `CREATE TABLE` succeed" but "does every RLS policy and guard trigger this project depends on still actually work" on the rebuilt schema. This is a real, automatable, always-honest proxy for disaster-recovery-from-nothing. It was executed end-to-end during this phase's own validation (§6) against a real scratch database, not merely written and left untested.
2. **`restored-production-backup-smoke-test`** — the "real" thing §17 actually names, and deliberately **not** something this workflow performs end-to-end itself. Pulling and restoring a live production backup from a public CI runner would put production database credentials on a shared runner and open network egress to a live database — a security decision this repo's eventual operator should make deliberately, with a real Supabase project and backup plan in hand, not something a sandbox session should silently wire up speculatively. Instead: an operator restores a periodic Supabase backup into a private, already-isolated instance out-of-band (Supabase's own point-in-time-recovery-to-a-new-project flow, documented as a manual runbook in `docs/DEPLOYMENT.md` §4), then points `BACKUP_RESTORE_TEST_DATABASE_URL` at it. This job, guarded on that one secret, then runs *only* `supabase/tests/smoke.sql` against that already-restored copy — never `db-migrate.sh`/`db-seed.sh`, since a restored production copy already has its own schema and real member data, and this job must never write to it beyond `smoke.sql`'s own small `SMOKE_`-prefixed throwaway fixture rows.

### 2.4 Platform scaffolding

- **`apps/web/vercel.json`** — `framework: nextjs` plus explicit `installCommand`/`buildCommand`/`ignoreCommand`, each `cd ../..`-relative to the monorepo root so `pnpm`/`turbo` resolve the workspace correctly; requires the Vercel project's own "Root Directory" dashboard setting to be `apps/web` (named in `docs/DEPLOYMENT.md` §6). `ignoreCommand` uses `turbo-ignore` so a push touching only, say, `apps/mobile` doesn't trigger a wasted web rebuild.
- **`apps/mobile/eas.json`** — three build profiles (`development`/`preview`/`production`) mapped to update channels (`development`/`staging`/`production`), matching the channel names `deploy.yml`'s `mobile-ota-update` job publishes to.

## 3. UI

No new user-facing UI this phase. The one new route (`/api/health`) is a JSON API endpoint with no rendered page, consistent with its purpose as a machine-readable monitoring target rather than a page a person visits.

## 4. Security review

- **`/api/health` is intentionally public** — added to `middleware.ts`'s `PUBLIC_PATHS` allowlist deliberately, not by omission, since an uptime monitor has no session of its own. Reviewed for information disclosure: the response body is a small fixed shape (`status`/`database`/`timestamp`) that never includes a stack trace, a connection string, row contents, or any distinguishing detail beyond "reachable" vs "unreachable" — an attacker learns only that the database is up, which is no more sensitive than the fact that the site itself loads.
- **The service-role client used by `/api/health`** is the same one already used server-side elsewhere in this codebase (no new credential exposure) — it never reaches the client bundle, and the route's own `try/catch` ensures any unexpected error (a malformed env var, a network blip) still returns the same safe fixed-shape `503`, never an unhandled exception with a stack trace.
- **No CI secret is ever logged or echoed.** Every new workflow step references a secret only via `${{ secrets.X }}`/`${{ vars.X }}` interpolation passed as an environment variable or CLI flag value (GitHub Actions automatically masks secret values in job logs); no step prints an env var wholesale or writes a secret to a file that gets uploaded as an artifact.
- **The backup-restore-drill's guarded job never runs `db-migrate.sh`/`db-seed.sh`** against a restored production copy (§2.3) — this was a deliberate design constraint, not an oversight, specifically to prevent an automated job from ever writing schema changes or seed data into a copy of real member data beyond `smoke.sql`'s own small throwaway fixture rows.
- **`deploy-production`'s `needs.run-production-migrations.result != 'failure'` check** was specifically reviewed to confirm it distinguishes "skipped" (this repo's current state — no `PRODUCTION_DATABASE_URL` yet) from "failed" (a real migration error) — a plain `needs:` dependency without the explicit `always()`/`result` check would have made `deploy-production` never run at all in this repo's current no-secrets state, silently masking the fact that it's the *deploy* job's own secrets, not the migration job's, gating it.
- No RLS policy, permission check, or server-side authorization logic is touched this phase; every change is CI/CD infrastructure, a new health-check route, or documentation.

## 5. Seed data changed this phase

None.

## 6. Validation performed

- **Both new GitHub Actions workflow files parse as valid YAML** (`python3 -c "import yaml; yaml.safe_load(...)"`), confirming all 6 jobs in `deploy.yml` and both jobs in `backup-restore-drill.yml` are syntactically well-formed.
- **`schema-rebuild-drill`'s logic was actually executed**, not just written: `scripts/db-smoke-test.sh` was run end-to-end against a real scratch Postgres database (`ngc_erp_backup_drill_sim`), rebuilding the schema from nothing and passing all 21 smoke assertions, then the scratch database was dropped — confirming the drill genuinely proves what it claims to prove.
- **`apps/web/e2e/health.spec.ts`'s 2 new assertions** — the endpoint is reachable without a session and reports `{status: "ok", database: "reachable"}`; a direct navigation to `/api/health` does not redirect to `/login` (unlike every other page in the `(erp)` app) — pass as part of the full suite run below.
- **`pnpm typecheck`** — clean across all 8 workspace packages.
- **`pnpm lint`** — clean (`next lint`: "No ESLint warnings or errors"; all other packages' `tsc --noEmit`-based lint clean).
- **`pnpm --filter @ngc/services test`** — 458/458 passing, unaffected by this phase's changes (no service-layer code touched).
- **`apps/web` rebuilt** (`turbo run build --filter=@ngc/web... --force`) — succeeds; `/api/health` confirmed present in the build's own route manifest output.
- **The full Playwright e2e suite — 84/84 passing**: the pre-existing 82 (77 from Phase 14.2 plus 5 from Phase 14.3) plus this phase's 2 new `health.spec.ts` assertions, with no regressions in any prior spec.

## 7. Open issues / deferred, not overlooked

- **Fourteen manual setup actions remain before any of this phase's automation actually deploys anything**, listed exhaustively in `docs/DEPLOYMENT.md` §6: Vercel project creation + Root Directory setting, `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`, Supabase project linking, `PRODUCTION_DATABASE_URL`, Supabase backup/PITR plan configuration, EAS project init + `EXPO_TOKEN` + channel creation, an error-tracking provider choice, an uptime-monitor choice, domain/DNS resolution (per `PRD.md` §14 item 10, already an open item from Phase 3), an SMS/WhatsApp/Email provider choice, and the first `eas submit` (deliberately manual). None of these can be completed from within this sandbox — no live cloud account exists here.
- **No error-tracking SDK is wired in yet.** `ERROR_TRACKING_DSN` exists as a named env var from an earlier phase but nothing reads it — `docs/DEPLOYMENT.md` §5 names this explicitly as an open gap rather than a completed integration, pending the provider choice above.
- **No uptime monitor is actually polling `/api/health` yet** — the endpoint exists and is verified reachable, but configuring an external poller against it is one of the manual setup items above.
- **14.4 (capstone regression + broader adversarial security review across all fourteen prior phases) remains un-done**, skipped per the user's own explicit "Proceed with phase 15" instruction rather than 14.3's own proposed continuation — named in this document's introduction and here again, matching this project's convention of never silently dropping a named item. It remains a reasonable candidate for future work if the user wants to return to it.
- **The "real" backup-restore drill (`restored-production-backup-smoke-test`) cannot be exercised in this sandbox** — it requires a live, already-restored Supabase backup copy that does not exist here. Its logic (guard, no migrate/seed, `smoke.sql`-only) was reviewed carefully (§2.3, §4) but only the sibling `schema-rebuild-drill` job was actually run.
- **This is the last phase named in `ARCHITECTURE.md` §19's roadmap.** Per the Development Control Rule, what (if anything) comes after Phase 15 requires the user's own explicit direction — nothing further is assumed or started automatically.
