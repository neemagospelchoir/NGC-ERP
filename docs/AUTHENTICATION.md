# AUTHENTICATION.md — Phase 6 Deliverable
## Neema Gospel Choir (NGC) ERP — Authentication & Session Management

**Status:** Implemented across `packages/db`, `packages/services`, and `apps/web`, and verified against a real running Next.js server plus a real (mocked) Auth/PostgREST HTTP endpoint — see §7 for what was actually run, not just written.

---

## 1. Scope (per the Development Control Rule)

This phase covers PRD.md's authentication requirements: email + password sign-in, sign-out, forgot/reset password, session persistence across requests via cookies, and resolving a signed-in user's roles/permissions for use by route guards and UI. It does **not** cover: MFA, SSO/social login, account self-registration (member accounts are provisioned through the Applications/Onboarding workflow in a later phase), or the admin UI for assigning roles (the `assignRole` service function exists and is tested; the screen that calls it is a Phase 7+ concern). These are out of scope by the governing spec, not omissions.

Dependencies / DB changes: none beyond what Phase 4 already created (`users`, `user_roles`, `roles`, `permissions`, `role_permissions`, `has_permission()`) — Phase 6 is entirely an application-layer phase. Two small Phase 4 artifacts needed a fix, described in §6.

## 2. Architecture

```
packages/db          Supabase client factories (browser / server / service-role) + generated Database type
packages/services     Framework-agnostic auth service functions (packages/services/src/auth/*)
apps/web              Next.js pages, Server Actions, middleware — the only layer that touches next/headers or cookies directly
```

### 2.1 `packages/db` — client factories

Three factories, each documented in-file with when to use which:

- `getSupabaseBrowserClient()` — memoized, `"use client"`-only, anon key. For client components that need direct Supabase access (none exist yet in Phase 6 — every auth action in this phase runs server-side).
- `createSupabaseServerClient(cookies: CookieAdapter)` — anon key + RLS, takes a `CookieAdapter` (`{getAll, setAll}`) so this package never imports `next/headers` itself (ARCHITECTURE.md §3's framework-agnostic rule). `apps/web/lib/supabase/server.ts` is the one file that binds this to `next/headers`' `cookies()`; `middleware.ts` binds it to `NextRequest`/`NextResponse` cookies directly, since middleware's cookie API differs from Server Components/Route Handlers.
- `getSupabaseServiceRoleClient()` — service-role key, RLS-bypassing, `server-only`-guarded. Used only where a caller must act across users (Phase 7's application-approval flow will need it; Phase 6's own `assignRole` service function takes an injected client and is tested with the RLS-scoped client for now — see §2.2).

### 2.2 `packages/services/src/auth` — auth service layer

Every function is a pure, dependency-injected function taking a `SupabaseClient<Database>` as its first argument (never importing a client factory itself), so each is unit-testable with a hand-rolled fake client (`__fixtures__/fake-supabase-client.ts`) with no network or Docker dependency:

| Function | Purpose |
|---|---|
| `signInWithPassword(client, {email, password})` | Wraps `auth.signInWithPassword`; normalizes email; maps GoTrue errors to a generic, non-enumerating message |
| `signOut(client)` | Wraps `auth.signOut` |
| `requestPasswordReset(client, email, redirectTo)` | Wraps `auth.resetPasswordForEmail`; always "succeeds" for an unknown email (GoTrue's own behavior — no account enumeration) |
| `updatePassword(client, newPassword)` | Wraps `auth.updateUser({password})`; enforces an 8-character minimum before calling Supabase |
| `getSession(client)` | Thin wrapper over `auth.getSession()` |
| `getCurrentUserWithRoles(client)` | Resolves the signed-in user's `users` row, `members` row (if any), active (non-revoked) `user_roles`, and the flattened, de-duplicated set of permission codes granted by those roles — the single call `middleware.ts`/`(erp)/layout.tsx`/any future route guard needs |
| `authorize(client, userId, permissionCode)` | Defense-in-depth permission check that takes an **explicit** `userId` instead of relying on `auth.uid()` — see §5.1 for why this matters |
| `assignRole(client, {actorUserId, targetUserId, roleCode, scopeType, scopeId})` | Admin-only role grant; calls `authorize()` itself before writing, so it fails closed even if ever wired to the RLS-bypassing service-role client without an upstream check |

`getCurrentUserWithRoles`/`authorize` deliberately issue several flat, single-table queries rather than one nested/embedded PostgREST select (`role_permissions(permission:permissions(code))`). The hand-generated `Database` type (see §6.1) doesn't carry the relationship metadata Supabase's own generator embeds, so nested selects don't type-check cleanly against it. Flat queries are a few more round trips but are fully typed and trivially fakeable in tests. **Follow-up for a later phase:** once a real hosted Supabase project exists and `supabase gen types` can run, consider collapsing this into a single `get_my_profile()` Postgres function/RPC for one round trip instead of up to six.

### 2.3 `apps/web` — pages, actions, middleware

- `middleware.ts` — refreshes the Supabase session cookie on every request (`auth.getUser()`, which revalidates the JWT server-side rather than trusting an unverified cookie) and redirects unauthenticated requests away from anything not in an explicit public-path allowlist. Layer 2 of three (see §5.2).
- `app/login/`, `app/forgot-password/`, `app/reset-password/` — Server Component page + Client Component form (React `useFormState`/`useFormStatus`) + a colocated `actions.ts` Server Action per page. Forms never call Supabase from the browser; every mutation runs server-side.
- `app/auth/callback/route.ts` — the PKCE code-exchange endpoint every emailed Supabase Auth link redirects to (today: password reset; later: invite/email-confirmation links reuse the same route).
- `app/(erp)/layout.tsx` — Layer 3 (see §5.2): re-resolves `getCurrentUserWithRoles()` server-side and redirects to `/login` if there's no session, independent of whether middleware ran. Renders `Sidebar`/`PageHeader`/`Avatar` from `packages/ui` with the real signed-in user.
- `app/(erp)/dashboard/page.tsx` — placeholder gated dashboard (Phase 7 replaces this with real content); useful in the meantime as a "why can't I see X" debugging view since it lists the signed-in user's own roles and permission count.

## 3. RBAC integration

No new authorization model was introduced. `getCurrentUserWithRoles` and `authorize` both read the exact `user_roles` / `roles` / `role_permissions` / `permissions` tables and the exact non-bypassable RLS policies Phase 4 built and validated (`docs/DATABASE.md`). Phase 6 adds an application-layer convenience (`authorize()`) for the narrow set of operations that must run through the RLS-bypassing service-role client — it is explicitly documented as defense-in-depth, not a replacement for RLS, in both `service-role-client.ts`'s and `authorize.ts`'s doc comments.

## 4. Environment constraint (carried over from Phase 6's kickoff, §13)

This sandbox cannot run a real Supabase project: `supabase start`'s local dev stack and `supabase gen types typescript --project-id <ref>` both pull Docker images from `ghcr.io`/`public.ecr.aws`, which this environment's network policy blocks (confirmed with direct `curl` tests against both registries). Two substitutions were made, both documented at the point of use rather than silently:

- **Types:** `packages/db/scripts/generate-types.mjs` introspects `information_schema` on a real local Postgres instance via the `pg` driver and emits a `Database` type shaped identically to Supabase's own generator's output (`Tables.<name>.{Row,Insert,Update,Relationships}`, `Views`, `Functions`) — confirmed shape-compatible by fixing a real type-checking failure it caused (§6.1). Once this project is linked to a real hosted Supabase project, `supabase gen types typescript --project-id <ref>` is a drop-in replacement; nothing else changes.
- **Live Auth verification:** no real GoTrue instance exists here either. `apps/web/e2e/mock-gotrue-server.mjs` is a small, real Node HTTP server implementing the subset of the GoTrue + PostgREST REST contract this app calls (password grant, PKCE code exchange, `GET/PUT /auth/v1/user`, `/auth/v1/recover`, `/auth/v1/logout`, and flat `rest/v1/<table>` reads with `eq./is./in.` filter support). It is a real second process Playwright starts alongside the real Next.js server — not a browser-side `page.route()` intercept — because middleware and Server Actions make their Supabase calls from the Next.js Node process itself, never through the browser page.

## 5. Security notes

### 5.1 Why `authorize()` takes an explicit `userId`

Postgres's `has_permission(p_permission_code)` (Phase 4) reads `auth.uid()` internally, which is only populated when the request carries the caller's own JWT. Called through the service-role client — which by design carries no user JWT, because its entire purpose is to bypass RLS for operations that must act on another user's behalf — `auth.uid()` would read `NULL` and the check would always fail (or, in a differently-written implementation, silently pass). `authorize()` avoids this by taking the acting user's id explicitly and re-deriving their active roles/permissions from the same tables `has_permission()` reads, so it fails closed rather than silently.

### 5.2 Three-layer defense in depth

1. **Postgres RLS** — the non-bypassable boundary; enforced regardless of any application code (Phase 4).
2. **`middleware.ts`** — redirects an unauthenticated request away from any non-public path before it reaches a page/action.
3. **`(erp)/layout.tsx`** — re-checks server-side on every request to that route group, independent of whether middleware ran (e.g. a future `matcher` config change).

No layer trusts the one "above" it to have already done the job.

### 5.3 No account enumeration

`requestPasswordReset` and `signInWithPassword`'s error mapping (`mapSupabaseAuthError`) both collapse "user not found" and "wrong password" into the same generic message. This mirrors GoTrue's own behavior for password-reset requests (always 200, regardless of whether the email is registered) rather than adding a "helpful" existence check that would leak it.

### 5.4 Redirect targets are never derived from the request Host header

`app/auth/callback/route.ts` builds its post-exchange redirect from `NEXT_PUBLIC_APP_URL`, not from the incoming request's `Host` header / `request.url` origin. This was fixed during this phase's own Playwright verification (§7.1, bug 2) and is also a standard host-header-injection/open-redirect precaution independent of the bug that surfaced it.

## 6. Bugs found and fixed (this phase's actual validation, not a description)

Consistent with the project-wide rule that nothing is marked complete on the strength of "the code compiles" alone, two real defects were caught only because the full stack was actually built, started, and driven through a real browser — neither would have been caught by `tsc`/`eslint` alone.

### 6.1 Generated `Database` type didn't satisfy `@supabase/supabase-js`'s `GenericTable`

`tsc --noEmit` failed across `packages/services/src/auth/*.ts` with `Property 'role_id' does not exist on type 'never'` — a confusing error with no obvious cause. Root cause: `@supabase/supabase-js`'s `SupabaseClient<Database>` requires every table entry to include a `Relationships: GenericRelationship[]` field (and the schema to include a `Functions` map); `packages/db/scripts/generate-types.mjs` was only emitting `Row`/`Insert`/`Update`. TypeScript's structural typing silently collapsed the mismatched table type to `never` several layers downstream instead of failing at the point of mismatch. Fixed by adding `Relationships: [];` to every generated table/view and a `Functions` block (covering `has_permission`, `has_role`, `next_formatted_id`, matched against the real function signatures in Postgres via `\df`) to the generator, then regenerating and re-verifying `tsc --noEmit` passes for `@ngc/db`, `@ngc/services`, and `@ngc/web`.

A related, separate version-skew issue was hit at the same time: `@supabase/ssr@0.5.x`'s bundled type definitions predate a generic-parameter change in `@supabase/supabase-js@2.112.x`, producing the same class of `SupabaseClient<...>` structural mismatch across every page/action in `apps/web`. Fixed by bumping `@supabase/ssr` to `^0.12.0` in `packages/db` and `apps/web`.

### 6.2 `Sidebar` was missing `"use client"`

First Playwright run against `/dashboard` crashed the whole request with `Error: Event handlers cannot be passed to Client Component props`. `packages/ui/src/components/Sidebar.tsx` attaches an `onClick` handler to its nav links but was never marked `"use client"` — a Phase 5 defect that Phase 5's own verification didn't catch because the only place `Sidebar` was rendered (the style guide page) was itself already a Client Component, which papered over the missing boundary. Rendering it from `(erp)/layout.tsx` — a genuine Server Component — surfaced it immediately. Fixed by adding `"use client"` to `Sidebar.tsx`.

### 6.3 Password-reset redirect silently dropped the session cookie

The full request → email-link → set-new-password Playwright test failed with the reset-password page always showing "this link has expired," even though the PKCE code exchange itself was succeeding. Cookie inspection (logging `context.cookies()` before/after the callback request) showed the session cookie was being set correctly for domain `127.0.0.1` — but the callback's `NextResponse.redirect()` was sending the browser to `localhost:3100` instead, a different cookie-storage origin, so the very next request carried no session cookie at all. Fixed as described in §5.4: build the redirect target from the configured `NEXT_PUBLIC_APP_URL` instead of the request's own derived origin. Re-verified with the same cookie-logging technique that the origin stays consistent end to end.

## 7. Validation performed

- **Unit tests** (`packages/services`, `tsx --test`, no network/Docker dependency): 23 tests across `sign-in`, `sign-out`, `password-reset`, `authorize`, `assign-role`, and `roles` (`getCurrentUserWithRoles`) — including negative cases (wrong credentials, revoked role grants, unknown permission codes, unauthorized `assignRole` attempts, a user with no `members` row yet, a `users` row missing entirely). All 23 pass.
- **Typecheck/lint/build**: `pnpm typecheck` (all 8 workspace packages via Turborepo), `pnpm --filter @ngc/web lint`, and `pnpm --filter @ngc/web build` (production build) all pass with zero errors or warnings.
- **End-to-end** (`apps/web/e2e`, Playwright against a real `next start` production server + the real `mock-gotrue-server.mjs` process — see §4): 7 scenarios covering the unauthenticated redirect, wrong-credentials inline error, successful sign-in reaching the gated dashboard with real role/permission data rendered, sign-out revoking access, the forgot-password generic-confirmation message, the expired/no-session guard on `/reset-password`, and the full request → callback → new-password → dashboard round trip. All 7 pass, run twice consecutively to rule out flakiness.

### 7.1 What is *not* covered, and why

- **A real hosted Supabase project** — blocked by this sandbox's network policy (§4); the mock server matches the documented REST contract but cannot substitute for testing against actual GoTrue behavior (rate limiting specifics, real email delivery, real JWT signing). This should be the first thing re-verified once a real Supabase project is linked.
- **MFA, SSO, and self-registration** — out of scope for this phase (§1).
- **The role-assignment admin screen** — the `assignRole` service function is unit-tested; no UI calls it yet (Phase 7+).
- **Playwright in CI** — `pnpm --filter @ngc/services test` (23 unit tests) was added to `.github/workflows/ci.yml`; the Playwright suite was not, since it depends on a pinned local Chromium path that only exists in this development sandbox (`apps/web/playwright.config.ts` only applies that override when the path exists, so the config itself is portable). Wiring it into CI is a one-line follow-up (`playwright install --with-deps` before `npx playwright test`), left documented rather than done unverified.

## 8. Environment variables introduced

No new variables beyond what `.env.example` already declared in Phase 4 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`) — Phase 6 is the first phase to actually consume them.
