# DEPLOYMENT.md — Environments, CI/CD, Secrets, Backups & Monitoring

Phase 15's own deliverable doc (`docs/PHASE_15.md`) covers what was built and validated this phase; this file is the durable reference an operator actually follows to take this platform from "code in a repo" to a running production system, and to keep it running. It implements `docs/ARCHITECTURE.md` §17 ("Deployment & DevOps Architecture") directly — every heading below corresponds to one of that section's bullets.

This repository, as delivered, has **no live Vercel, Supabase, or Expo account connected** — every piece of infrastructure described here (`.github/workflows/deploy.yml`, `.github/workflows/backup-restore-drill.yml`, `apps/web/vercel.json`, `apps/mobile/eas.json`) is real, correct, and ready to activate, but genuinely inert until the one-time manual setup in §6 is done. This is deliberate: a sandboxed coding environment cannot itself hold real production credentials, click through a hosting provider's dashboard, or own a real domain, so this phase built everything short of those irreducibly-manual, human-owned steps.

## 1. Environments

Per §17, three environments, never sharing secrets:

| Environment | Purpose | Data | Branch |
|---|---|---|---|
| **Local/dev** | A developer's own machine | Whatever they seed locally (`scripts/db-seed.sh demo`) | any feature branch |
| **Staging** | Mirrors production's schema exactly; the pre-production check | Seeded with clearly-labeled `DEMO_*` records only (`scripts/db-seed.sh demo`) — never real member/financial/discipline data | `develop` |
| **Production** | The real, live system | Real institutional data | `main` |

A feature branch is developed and reviewed locally, merged to `develop` (deploys to staging automatically — §2), verified there, then merged to `main` (deploys to production automatically). Nothing is ever deployed to production directly from a feature branch.

## 2. CI/CD pipeline

Two separate GitHub Actions workflows, deliberately kept apart because they answer different questions:

- **`.github/workflows/ci.yml`** — runs on every pull request (and every push to `develop`/`main`, redundantly with what already ran on the PR): migrations apply cleanly + the Phase 14.2 database smoke suite, lint/typecheck/build, unit tests, the Playwright e2e suite (including Phase 14.3's accessibility scan), and a manual security-review-checklist gate. Answers "is this change safe to merge."
- **`.github/workflows/deploy.yml`** — runs only on a push to `develop`/`main` or a `v*` tag, and only ever ships something once the PR-gate above has already passed on that same commit (GitHub's branch protection should require `ci.yml`'s checks before allowing the merge that triggers this). Answers "now actually ship it," per §17's exact CD bullet:
  - **`develop` push** → `migration-dry-run` (always runs, no secrets needed — replays every migration against a disposable database) + `deploy-staging` (Vercel, guarded on secrets).
  - **`main` push** → `run-production-migrations` (applies pending migrations to the real production database) → `deploy-production` (Vercel) + `mobile-ota-update` (Expo EAS Update, publishes to the `production` channel) — the latter two run once migrations either succeed or are skipped (not configured yet), but never once migrations actually fail.
  - **`v*` tag push** → `mobile-native-release` (triggers an EAS Build for both platforms; app-store *submission* is deliberately left as a manual `eas submit` command an operator runs after reviewing the build — see §6 — auto-submitting to a public app store on every tag is a bigger, more consequential decision than this phase should make unattended).
- **`.github/workflows/backup-restore-drill.yml`** — scheduled weekly (plus manual `workflow_dispatch`), covers §4.

Every deploy.yml job is guarded with a job-level `if: secrets.X != ''` (or the equivalent `vars.X != ''` for non-secret config) check, so until §6's setup is done, every job shows as cleanly **skipped** in the Actions tab — never a false "success" that didn't actually deploy anything, never a red "failure" for infrastructure that was never supposed to exist yet.

## 3. Environment variables & secrets matrix

`.env.example` lists every variable an application instance needs (copy to `.env.local` for `apps/web`, or export for `scripts/db-*.sh`). This table adds where each one actually lives per environment, and which CI secrets `deploy.yml`/`backup-restore-drill.yml` additionally need (these never appear in `.env.example`, since they're consumed by CI itself, not by the running app):

| Variable | Local/dev | Staging | Production | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local Supabase project (or a personal dev project) | staging Supabase project | production Supabase project | Never the same project across environments — `.env.local` / Vercel project env vars (scoped per Vercel environment) |
| `SUPABASE_SERVICE_ROLE_KEY` | local project's key | staging project's key | production project's key | Server-only; never in a client bundle (enforced by `packages/db/src/service-role-client.ts`'s `server-only` import) |
| `DATABASE_URL` | local Postgres | Supabase connection string | Supabase connection string | Only ever read by `scripts/db-*.sh` and CI — never by the running app itself |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | staging URL | `https://ngc.co.tz` (or whatever domain — PRD §14 item 10 is still an open NGC decision) | |
| `EMAIL_`/`SMS_`/`WHATSAPP_`/`EXPO_PUSH_` provider keys | test/sandbox provider credentials, or left blank (channel disables cleanly — ARCHITECTURE §14) | provider's own staging/sandbox mode | live provider credentials | Independently toggleable per PRD §13 — launching with only some configured is a supported, intentional state |
| `AI_PROVIDER` / `AI_API_KEY` | optional | optional | optional | Advisory-only per ARCHITECTURE §14; the platform is fully functional with these blank |
| `ERROR_TRACKING_DSN` | usually blank | staging project's DSN | production project's DSN | See §5 — provider not yet chosen |

CI-only secrets (`deploy.yml`/`backup-restore-drill.yml`; configure as **GitHub Environment secrets**, scoped to the `staging`/`production` Environments both workflows already reference, not repository-wide secrets — see §6):

| Secret / variable | Used by | Scope |
|---|---|---|
| `VERCEL_TOKEN` (secret) | `deploy-staging`, `deploy-production` | both |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (repository/environment **variables**, not secrets — these identify the project, they don't grant access on their own) | same | both |
| `PRODUCTION_DATABASE_URL` (secret) | `run-production-migrations` | production only |
| `EXPO_TOKEN` (secret) | `mobile-ota-update`, `mobile-native-release` | production only |
| `BACKUP_RESTORE_TEST_DATABASE_URL` (secret) | `restored-production-backup-smoke-test` | production only — see §4 |

## 4. Backups & restore testing

Per §17: automated daily backups + PITR where the plan supports it, **and periodic restoration testing** — a backup nobody has ever restored is a backup nobody actually knows works.

- **Automated backups**: configured on the Supabase project dashboard once a real project exists (plan-dependent — PITR requires at minimum the Pro plan; confirm current pricing/tiers directly with Supabase before committing to a plan, since this changes over time). Not something this repository's code can configure — a hosting-account setting, tracked in §6.
- **Restore testing, automated proxy (`schema-rebuild-drill`, runs weekly, no secrets needed)**: rebuilds the entire schema from `supabase/migrations` into a disposable Postgres 16 container from nothing, then runs the Phase 14.2 smoke suite (`supabase/tests/smoke.sql`) against it — proving not just that every migration still applies, but that RLS and every guard trigger this platform depends on still behave correctly on a freshly rebuilt schema. This is a genuine, always-running check, but it is **not** a test of restoring an actual Supabase-managed backup (no real backup artifact, no real data involved).
- **Restore testing, the real thing (`restored-production-backup-smoke-test`, guarded)**: deliberately NOT automated end-to-end by this repository — pulling a live production backup onto a public CI runner is a security decision (production credentials reaching a shared runner, network egress to a live database) an operator should make deliberately, not something wired up unattended in a coding sandbox. The runbook:
  1. On a recurring cadence (start monthly; tighten once real usage patterns are known), use Supabase's own backup-restore flow (dashboard "Restore" action, or their PITR-to-new-project flow) to restore the latest backup into a **separate, isolated** Supabase project — never restore over the real production project.
  2. Point the `BACKUP_RESTORE_TEST_DATABASE_URL` secret at that restored copy's connection string.
  3. Manually trigger `backup-restore-drill.yml` (`workflow_dispatch`) — its `restored-production-backup-smoke-test` job runs `supabase/tests/smoke.sql` (read/small-throwaway-write only, never `db-migrate.sh`/`db-seed.sh`, since the restored copy already has its own real schema and data) against the restored copy.
  4. Tear down the temporary restored project once the drill passes (or investigate immediately if it doesn't — a failed restore-test is a production-readiness emergency, not a backlog item).

## 5. Monitoring & alerting

Per §17: uptime/error monitoring on both the web app and Edge Functions; failed-notification and failed-migration alerts routed to the Super Admin/technical maintainer.

- **Uptime**: `apps/web/app/api/health/route.ts` (new this phase) is a public, unauthenticated endpoint that checks real Postgres connectivity through Supabase's REST layer (not just "did the Next.js process boot") — point any uptime monitor (Vercel's own, or a third-party like UptimeRobot/Better Stack/Pingdom) at `https://<app-url>/api/health` on a short interval; alert on a non-200 or a timeout. No specific provider is chosen yet — a business/cost decision, not a technical blocker.
- **Error tracking**: `ERROR_TRACKING_DSN` is already a recognized env var (`.env.example`, since before this phase) but no error-tracking SDK (Sentry or equivalent) is wired into `apps/web`/`apps/mobile` yet — installing and configuring one, and deciding on a specific provider, remains open (named here rather than silently assumed done).
- **Failed migrations**: `run-production-migrations` failing in `deploy.yml` already blocks `deploy-production`/`mobile-ota-update` from running (§2) — wiring an actual notification (e.g. a GitHub Actions step that posts to Slack/email/PagerDuty on failure) to the Super Admin/technical maintainer, per §17's exact wording, is not yet configured — the failure is visible in the Actions tab today, not yet pushed to a person. A reasonable next step once a notification channel is chosen.
- **Failed notification dispatch**: `communications.notifications.send`'s own delivery success/failure (Phase 10.2) is application-level, not deployment-level — routing a failure there to Super Admin is a `packages/services/src/notifications` feature, out of this phase's scope.

## 6. One-time manual setup checklist

Everything below is a real account/dashboard action an operator does exactly once, outside this repository, before any of the automation above does anything beyond "skipped":

- [ ] Create (or confirm) a Vercel account/team; create a Vercel project for `apps/web`, with **Root Directory set to `apps/web`** (required — `apps/web/vercel.json`'s `buildCommand`/`installCommand` assume this).
- [ ] Generate a Vercel API token; add it as the `VERCEL_TOKEN` secret on both the `staging` and `production` GitHub Environments (Settings → Environments in this repo).
- [ ] Record the Vercel org ID and project ID as the `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` **variables** (not secrets) on both Environments.
- [ ] Create a Supabase project for staging and a separate one for production; run `supabase link --project-ref <ref>` locally once per environment as needed for any manual admin work (`supabase/config.toml`'s own comment already notes this hasn't happened yet).
- [ ] Add each environment's real Postgres connection string as `PRODUCTION_DATABASE_URL` (production Environment only — staging's migration step is currently a dry-run only, per §2; add a `STAGING_DATABASE_URL` + a real migration-apply job later if staging's own database should also be migrated automatically rather than dry-run only).
- [ ] Configure Supabase's automated-backup settings and confirm the plan includes PITR if required (§4).
- [ ] Create an Expo/EAS account; run `eas init` inside `apps/mobile` once to register the project and replace `app.json`'s `extra.eas.projectId` placeholder ("PENDING…", per `docs/PHASE_12_1.md` §7) with the real ID.
- [ ] Generate an Expo access token; add it as the `EXPO_TOKEN` secret on the `production` Environment.
- [ ] Run `eas channel:create production` / `eas channel:create staging` (or equivalent branch/channel mapping) so `mobile-ota-update`'s `--channel production` target actually exists.
- [ ] Choose and provision an error-tracking provider; set `ERROR_TRACKING_DSN` per environment and wire its SDK into `apps/web`/`apps/mobile` (§5 — not yet done).
- [ ] Choose and provision an uptime monitor pointed at `/api/health` (§5).
- [ ] Resolve the domain/DNS decision named as open in `docs/PRD.md` §14 item 10, then set `NEXT_PUBLIC_APP_URL`/`EXPO_PUBLIC_APP_URL` accordingly and attach the domain in Vercel.
- [ ] Decide and provision real SMS/WhatsApp/Email providers per `docs/PRD.md` §13 (each channel launches disabled/blank until then — a supported state, not a blocker).
- [ ] The first production release: after `mobile-native-release` produces a build from a `v*` tag, an operator manually runs `eas submit` (the `submit.production` profile in `apps/mobile/eas.json` is ready) once they've reviewed the build — deliberately not automatic (§2).
