#!/usr/bin/env node
/**
 * Standalone mock Supabase Auth (GoTrue) + PostgREST server for Playwright
 * verification (see docs/AUTHENTICATION.md "Environment constraints"). This
 * exists as a REAL Node HTTP server — not a Playwright page.route() browser-
 * side intercept — because middleware.ts and every Server Action/Route
 * Handler in apps/web run server-side and make their Supabase calls
 * directly from the Next.js Node process, never through the browser. Only a
 * real listener on the URL those calls target (NEXT_PUBLIC_SUPABASE_URL)
 * can answer them.
 *
 * State is intentionally mutable and test-controlled via two endpoints
 * under /__test__/*, since Playwright's webServer keeps one process alive
 * across the whole spec file (this test suite runs with fullyParallel:
 * false, one worker, precisely so this shared state stays coherent):
 *   POST /__test__/reset  — clears all in-memory state
 *   POST /__test__/seed   — body: { users: MockUser[], data: MockDataset }
 *   GET  /__test__/health — used by Playwright's webServer readiness probe
 *
 * Phase 7.1 additions (on top of the Phase 6 auth-only mock): generic
 * POST (insert) and PATCH (update) handling for ANY table (not just the
 * auth-related ones), an `ilike`/`or` filter implementation (Members' name
 * search uses both), `order`/`limit`, and an RPC dispatch table for the
 * one Postgres function the web app calls directly — `next_formatted_id`
 * (Member ID generation). This mock does not attempt to replicate RLS,
 * unique-constraint violations, or transactional atomicity — those are
 * covered by the adversarial psql tests and the @ngc/services unit test
 * fixtures respectively (see docs/PHASE_7_1.md); this server exists only to
 * exercise the real Next.js request/response wiring end-to-end.
 *
 * Phase 7.3 additions: `neq`/`gte`/`lte` filter support (Attendance's
 * roster query excludes exited members via `neq`, and session listing's
 * date-range filter uses `gte`/`lte`) — same string-comparison approach as
 * the ISO-date-string `gte`/`lte` added to the @ngc/services unit-test
 * fixture, since this mock has no real Postgres type system either.
 *
 * Phase 7.4 additions: two Discipline-specific RPC mocks —
 * `find_member_by_number_for_discipline` (exact member_number match) and
 * `apply_disciplinary_membership_status` (sets membership_status/exited_at/
 * exit_reason on a member row). Neither enforces the real functions'
 * `has_permission('discipline.cases.manage')` check — consistent with this
 * mock's existing, documented scope: it exercises the real Next.js request/
 * response wiring, not the RLS/permission security boundary itself (that's
 * covered by the actual migration SQL and, at the application layer, by
 * this module's own permissionCodes-driven UI gates, which ARE exercised
 * here since they're plain JS).
 *
 * Phase 7.5 addition: `record_workflow_decision`, mirroring 0028's SQL
 * state-machine (advance/resolve a `workflow_instances` row) but likewise
 * NOT re-verifying the caller holds the current step's role — that check
 * is exercised by packages/services/src/workflow/record-decision.ts's own
 * pre-check instead, same division of labor as the two Discipline RPCs
 * above.
 *
 * Phase 8.3 addition: `start_gate_pass_workflow`, mirroring 0029's SQL
 * (pending_approval + has-items + no-existing-instance checks, then
 * create the `workflow_instances` row) but likewise NOT re-verifying
 * `inventory.gate_passes.manage` — same division of labor as every other
 * RPC mock here.
 *
 * Phase 8.4 addition: generic DELETE handling for ANY table — a genuine
 * first for this mock. Every previous module only ever inserted/updated
 * rows (even Discipline and Gate Passes never delete anything — spec S33's
 * "never deleted" convention), so no test before Playlists' `removePlaylistItem`
 * (packages/services/src/playlists/items.ts) ever issued a real DELETE
 * request against this server; without this handler it fell through to the
 * generic 501 `unmocked_gotrue_endpoint` response, exactly the kind of gap
 * this mock's own doc comment above says an e2e run should catch. Mirrors
 * the PATCH handler's shape (match via `queryTable`, then remove those rows
 * from `dataset[table]`) and, like every other generic handler here, does
 * not attempt to replicate ON DELETE CASCADE or RLS.
 *
 * Phase 9.2 addition: `start_expense_request_workflow`, mirroring 0031's
 * SQL (draft-only + no-existing-instance checks, flip `expense_requests.
 * status` to `pending_approval`, then create the `workflow_instances` row)
 * but likewise NOT re-verifying `requested_by = auth.uid()` — same division
 * of labor as every other RPC mock here (that self-submission check is
 * exercised against a real Postgres instance instead, docs/PHASE_9_2.md
 * §4/§6).
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = 54321;

let dataset = {};
let users = [];
let activeTokens = new Map(); // access token -> user
let tokenCounter = 0;
let sequenceCounters = new Map(); // `${sequenceKey}:${year}` -> last value

function issueToken(userId) {
  tokenCounter += 1;
  return `mock-access-token-${userId}-${tokenCounter}`;
}

function sessionBodyFor(user, accessToken) {
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `mock-refresh-token-${user.id}`,
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

function ilikeMatch(value, pattern) {
  if (value === null || value === undefined) return false;
  const stripped = pattern.replace(/^%/, "").replace(/%$/, "");
  return String(value).toLowerCase().includes(stripped.toLowerCase());
}

function matchesFilter(row, column, expr) {
  if (expr === "is.null") return row[column] === null || row[column] === undefined;
  if (expr === "not.is.null") return row[column] !== null && row[column] !== undefined;
  if (expr.startsWith("eq.")) return String(row[column]) === expr.slice(3);
  if (expr.startsWith("neq.")) return String(row[column]) !== expr.slice(4);
  if (expr.startsWith("gte.")) return row[column] !== null && row[column] !== undefined && String(row[column]) >= expr.slice(4);
  if (expr.startsWith("lte.")) return row[column] !== null && row[column] !== undefined && String(row[column]) <= expr.slice(4);
  if (expr.startsWith("ilike.")) return ilikeMatch(row[column], expr.slice(6));
  if (expr.startsWith("in.")) {
    const values = expr.slice(4, -1).split(",").map((v) => v.trim());
    return values.includes(String(row[column]));
  }
  return true;
}

/** Parses a PostgREST `or=(col.op.val,col2.op2.val2)` param value into per-condition {column, expr} pairs. */
function parseOrParam(raw) {
  const inner = raw.startsWith("(") && raw.endsWith(")") ? raw.slice(1, -1) : raw;
  return inner
    .split(",")
    .map((segment) => {
      const firstDot = segment.indexOf(".");
      if (firstDot === -1) return null;
      return { column: segment.slice(0, firstDot), expr: segment.slice(firstDot + 1) };
    })
    .filter((c) => c !== null);
}

function queryTable(rows, searchParams) {
  let result = rows;

  for (const [key, value] of searchParams.entries()) {
    if (key === "select" || key === "order" || key === "limit") continue;
    if (key === "or") {
      const conditions = parseOrParam(value);
      result = result.filter((row) => conditions.some(({ column, expr }) => matchesFilter(row, column, expr)));
      continue;
    }
    result = result.filter((row) => matchesFilter(row, key, value));
  }

  const order = searchParams.get("order");
  if (order) {
    const [column, direction] = order.split(".");
    result = [...result].sort((a, b) => {
      const av = a[column];
      const bv = b[column];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return direction === "desc" ? -cmp : cmp;
    });
  }

  const limit = searchParams.get("limit");
  if (limit) {
    result = result.slice(0, Number(limit));
  }

  return result;
}

function isSingleObjectRequest(req) {
  return (req.headers["accept"] ?? "").startsWith("application/vnd.pgrst.object+json");
}

function nextFormattedId(sequenceKey, format) {
  const year = new Date().getFullYear();
  const counterKey = `${sequenceKey}:${year}`;
  const next = (sequenceCounters.get(counterKey) ?? 0) + 1;
  sequenceCounters.set(counterKey, next);
  return String(format).replace("{year}", String(year)).replace("{sequence}", String(next).padStart(4, "0"));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function send(res, status, body) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

/** Responds with the representation of an insert/update, honoring the caller's single-vs-array Accept header the same way real PostgREST would. */
function sendRepresentation(req, res, rows) {
  if (isSingleObjectRequest(req)) {
    if (rows.length === 0) {
      return send(res, 406, {
        code: "PGRST116",
        details: "Results contain 0 rows",
        hint: null,
        message: "JSON object requested, multiple (or no) rows returned",
      });
    }
    return send(res, 200, rows[0]);
  }
  return send(res, 200, rows);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/__test__/health") return send(res, 200, { ok: true });

  if (url.pathname === "/__test__/reset" && req.method === "POST") {
    users = [];
    dataset = {};
    activeTokens = new Map();
    sequenceCounters = new Map();
    return send(res, 200, { ok: true });
  }

  if (url.pathname === "/__test__/seed" && req.method === "POST") {
    const body = await readJsonBody(req);
    users = body.users ?? [];
    dataset = { ...dataset, ...(body.data ?? {}) };
    return send(res, 200, { ok: true });
  }

  if (url.pathname === "/auth/v1/token") {
    const grantType = url.searchParams.get("grant_type");
    const body = await readJsonBody(req);

    if (grantType === "password") {
      const email = String(body.email ?? "").toLowerCase();
      const password = String(body.password ?? "");
      const user = users.find((u) => u.email.toLowerCase() === email);
      if (!user || user.password !== password) {
        return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
      }
      const token = issueToken(user.id);
      activeTokens.set(token, user);
      return send(res, 200, sessionBodyFor(user, token));
    }

    if (grantType === "pkce") {
      // Not validating the code/verifier pair against the request body —
      // this mock stands in for GoTrue's response shape, not its crypto.
      const user = [...activeTokens.values()][0] ?? users[0];
      if (!user) return send(res, 400, {});
      const token = issueToken(user.id);
      activeTokens.set(token, user);
      return send(res, 200, sessionBodyFor(user, token));
    }

    if (grantType === "refresh_token") {
      const refreshToken = String(body.refresh_token ?? "");
      const user = [...activeTokens.values()].find((u) => refreshToken.includes(u.id)) ?? users[0];
      if (!user) return send(res, 400, {});
      const token = issueToken(user.id);
      activeTokens.set(token, user);
      return send(res, 200, sessionBodyFor(user, token));
    }

    return send(res, 400, {});
  }

  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    const token = (req.headers["authorization"] ?? "").replace("Bearer ", "");
    const user = activeTokens.get(token);
    if (!user) return send(res, 401, { error: "unauthorized", error_description: "Invalid or expired token" });
    return send(res, 200, sessionBodyFor(user, token).user);
  }

  if (url.pathname === "/auth/v1/user" && req.method === "PUT") {
    const token = (req.headers["authorization"] ?? "").replace("Bearer ", "");
    const user = activeTokens.get(token);
    if (!user) return send(res, 401, {});
    await readJsonBody(req);
    return send(res, 200, sessionBodyFor(user, token).user);
  }

  if (url.pathname === "/auth/v1/recover") {
    await readJsonBody(req);
    return send(res, 200, {});
  }

  if (url.pathname === "/auth/v1/logout") {
    const token = (req.headers["authorization"] ?? "").replace("Bearer ", "");
    activeTokens.delete(token);
    return send(res, 204, "");
  }

  const rpcMatch = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (rpcMatch && req.method === "POST") {
    const fn = rpcMatch[1];
    const body = await readJsonBody(req);
    if (fn === "next_formatted_id") {
      const result = nextFormattedId(body.p_sequence_key, body.p_format);
      return send(res, 200, JSON.stringify(result));
    }
    if (fn === "find_member_by_number_for_discipline") {
      const rows = dataset.members ?? [];
      const match = rows.find((m) => m.member_number === body.p_member_number);
      const result = match
        ? [{ id: match.id, first_name: match.first_name, last_name: match.last_name, member_number: match.member_number, membership_status: match.membership_status }]
        : [];
      return send(res, 200, result);
    }
    if (fn === "apply_disciplinary_membership_status") {
      const rows = dataset.members ?? [];
      const member = rows.find((m) => m.id === body.p_member_id);
      if (member) {
        member.membership_status = body.p_status;
        member.exited_at = body.p_status === "exited" ? new Date().toISOString().slice(0, 10) : null;
        member.exit_reason = body.p_status === "exited" ? body.p_exit_reason ?? null : null;
      }
      return send(res, 200, null);
    }
    if (fn === "record_workflow_decision") {
      // Phase 7.5 addition. Like the two Discipline RPC mocks above, this
      // does NOT re-verify the caller actually holds the current step's
      // required role — that check (0028's `record_workflow_decision`
      // itself, in the real database) is exactly what
      // packages/services/src/workflow/record-decision.ts's own
      // application-layer pre-check exists to exercise here instead: it
      // already refuses a mismatched caller BEFORE this RPC is ever
      // called, using the same instance/step rows this mock also reads.
      // This mock only performs the mechanical state transition — insert
      // a decision row, then advance/resolve the instance — mirroring
      // 0028's SQL exactly (advance to the next step_order on "approve"
      // unless already at the max step_order for the definition, in
      // which case the instance becomes "approved"; "reject" ->
      // "rejected"; "request_changes" leaves the instance pending at the
      // same step).
      const token = (req.headers["authorization"] ?? "").replace("Bearer ", "");
      const callingUser = activeTokens.get(token);

      const instances = dataset.workflow_instances ?? [];
      const instance = instances.find((i) => i.id === body.p_workflow_instance_id);
      if (!instance) return send(res, 404, { message: "Workflow instance not found" });

      const steps = dataset.workflow_definition_steps ?? [];
      const currentStep = steps.find(
        (s) => s.workflow_definition_id === instance.workflow_definition_id && s.step_order === instance.current_step_order
      );

      if (!dataset.workflow_step_decisions) dataset.workflow_step_decisions = [];
      dataset.workflow_step_decisions.push({
        id: randomUUID(),
        workflow_instance_id: instance.id,
        step_order: instance.current_step_order,
        approver_id: callingUser?.id ?? "unknown",
        approver_role_code: currentStep?.required_role_code ?? null,
        decision: body.p_decision,
        comment: body.p_comment ?? null,
        decided_at: new Date().toISOString(),
      });

      if (body.p_decision === "reject") {
        instance.status = "rejected";
      } else if (body.p_decision === "approve") {
        const maxStep = Math.max(
          ...steps.filter((s) => s.workflow_definition_id === instance.workflow_definition_id).map((s) => s.step_order)
        );
        if (instance.current_step_order >= maxStep) {
          instance.status = "approved";
        } else {
          instance.current_step_order += 1;
        }
      }
      // "request_changes": recorded as a fact only, instance stays pending at the same step.

      return send(res, 200, [
        { id: instance.id, status: instance.status, current_step_order: instance.current_step_order, record_type: instance.record_type, record_id: instance.record_id },
      ]);
    }
    if (fn === "start_gate_pass_workflow") {
      // Phase 8.3 addition, mirroring 0029's SQL logic (minus the
      // `inventory.gate_passes.manage` re-check, same division of labor as
      // every other RPC mock here — the real permission check is exercised
      // by the actual migration's SQL, not this mock; see this file's own
      // header). Validates pending_approval + at least one item + no
      // existing instance, then creates a `workflow_instances` row against
      // the seeded "Standard Gate Pass Approval" definition.
      const gatePasses = dataset.gate_passes ?? [];
      const gatePass = gatePasses.find((g) => g.id === body.p_gate_pass_id);
      if (!gatePass) return send(res, 404, { message: "Gate pass not found" });
      if (gatePass.status !== "pending_approval") {
        return send(res, 400, { message: "This gate pass is no longer awaiting submission" });
      }

      const items = (dataset.gate_pass_items ?? []).filter((i) => i.gate_pass_id === body.p_gate_pass_id);
      if (items.length === 0) {
        return send(res, 400, { message: "Add at least one item before submitting a gate pass for approval" });
      }

      const instances = dataset.workflow_instances ?? [];
      const existing = instances.find((i) => i.record_type === "gate_pass" && i.record_id === body.p_gate_pass_id);
      if (existing) {
        return send(res, 400, { message: "An approval workflow has already been started for this gate pass" });
      }

      const definitions = dataset.workflow_definitions ?? [];
      const definition = definitions.find((d) => d.record_type === "gate_pass" && d.is_active);
      if (!definition) {
        return send(res, 400, { message: "No active approval workflow is configured for gate passes" });
      }

      const now = new Date().toISOString();
      const instance = {
        id: randomUUID(),
        workflow_definition_id: definition.id,
        record_type: "gate_pass",
        record_id: body.p_gate_pass_id,
        current_step_order: 1,
        status: "pending",
        created_at: now,
        updated_at: now,
      };
      if (!dataset.workflow_instances) dataset.workflow_instances = [];
      dataset.workflow_instances.push(instance);

      return send(res, 200, [instance]);
    }
    if (fn === "start_expense_request_workflow") {
      // Phase 9.2 addition, mirroring 0031's SQL logic (minus the
      // `requested_by = auth.uid()` re-check, same division of labor as
      // every other RPC mock here). Validates draft + no existing
      // instance, flips the expense request to `pending_approval`, then
      // creates a `workflow_instances` row against the seeded "Standard
      // Expense Approval" definition — unlike `start_gate_pass_workflow`
      // above, this ALSO performs the status transition itself, matching
      // the real RPC doing both in one atomic transaction (0031's file
      // header explains why: gate passes have no separate draft state to
      // leave, expense requests do).
      const requests = dataset.expense_requests ?? [];
      const request = requests.find((r) => r.id === body.p_expense_request_id);
      if (!request) return send(res, 404, { message: "Expense request not found" });
      if (request.status !== "draft") {
        return send(res, 400, { message: "This expense request is no longer a draft" });
      }

      const instances = dataset.workflow_instances ?? [];
      const existing = instances.find((i) => i.record_type === "expense_request" && i.record_id === body.p_expense_request_id);
      if (existing) {
        return send(res, 400, { message: "An approval workflow has already been started for this expense request" });
      }

      const definitions = dataset.workflow_definitions ?? [];
      const definition = definitions.find((d) => d.record_type === "expense_request" && d.is_active);
      if (!definition) {
        return send(res, 400, { message: "No active approval workflow is configured for expense requests" });
      }

      request.status = "pending_approval";

      const now = new Date().toISOString();
      const instance = {
        id: randomUUID(),
        workflow_definition_id: definition.id,
        record_type: "expense_request",
        record_id: body.p_expense_request_id,
        current_step_order: 1,
        status: "pending",
        created_at: now,
        updated_at: now,
      };
      if (!dataset.workflow_instances) dataset.workflow_instances = [];
      dataset.workflow_instances.push(instance);

      return send(res, 200, [instance]);
    }
    if (fn === "send_notification") {
      // Phase 10.2 addition, mirroring 0033's SQL logic (minus the
      // `has_permission('communications.notifications.send')` re-check,
      // same division of labor as every other RPC mock here — that
      // authorization check is exercised against real Postgres, per
      // docs/PHASE_10_2.md §4/§6, not this mock). Resolves the audience
      // against `users`/`members` directly (this mock has no RLS at all,
      // so it can read across the whole dataset the way the real RPC's
      // SECURITY DEFINER context does) and inserts one `notifications` row
      // per resolved recipient, exactly mirroring the real function's own
      // `in_app` vs. every-other-channel `sent`-immediately-vs-`queued`
      // distinction.
      const users = dataset.users ?? [];
      const members = dataset.members ?? [];
      let recipientIds = [];
      if (body.p_audience === "all") {
        recipientIds = users.filter((u) => u.is_active).map((u) => u.id);
      } else if (body.p_audience === "department") {
        if (!body.p_department_id) return send(res, 400, { message: "A department is required for this audience" });
        recipientIds = members.filter((m) => m.primary_department_id === body.p_department_id && m.user_id).map((m) => m.user_id);
      } else if (body.p_audience === "family") {
        if (!body.p_family_id) return send(res, 400, { message: "A family is required for this audience" });
        recipientIds = members.filter((m) => m.family_id === body.p_family_id && m.user_id).map((m) => m.user_id);
      } else if (body.p_audience === "specific_users") {
        recipientIds = body.p_user_ids ?? [];
      } else {
        return send(res, 400, { message: `Unknown audience ${body.p_audience}` });
      }
      recipientIds = [...new Set(recipientIds)];
      if (recipientIds.length === 0) return send(res, 400, { message: "No recipients matched this audience" });

      const isInApp = body.p_channel === "in_app";
      const now = new Date().toISOString();
      if (!dataset.notifications) dataset.notifications = [];
      const inserted = recipientIds.map((recipientUserId) => {
        const row = {
          id: randomUUID(),
          recipient_user_id: recipientUserId,
          template_id: body.p_template_id ?? null,
          channel: body.p_channel,
          subject: body.p_subject ?? null,
          body: body.p_body,
          triggering_event: body.p_triggering_event ?? null,
          triggering_record_type: body.p_triggering_record_type ?? null,
          triggering_record_id: body.p_triggering_record_id ?? null,
          status: isInApp ? "sent" : "queued",
          sent_at: isInApp ? now : null,
          read_at: null,
          failure_reason: null,
          created_at: now,
        };
        dataset.notifications.push(row);
        return row;
      });
      return send(res, 200, inserted);
    }
    return send(res, 404, { error: "unmocked_rpc", fn });
  }

  const restMatch = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (restMatch && req.method === "GET") {
    const table = restMatch[1];
    const rows = dataset[table] ?? [];
    const result = queryTable(rows, url.searchParams);
    // Phase 7.4 fix: a real, previously-undetected gap. `.single()` (unlike
    // `.maybeSingle()`, which unwraps client-side regardless of server
    // behavior — see postgrest-js's own doc comment on the method) relies
    // ENTIRELY on the server honoring the `Accept: application/vnd.pgrst.
    // object+json` header by returning one bare object, not a one-item
    // array. This GET handler used to always return an array regardless,
    // so every `.select().eq(...).single()` read (as opposed to
    // `.insert()/.update()...select().single()`, which already went
    // through sendRepresentation() below) silently got back an array
    // instead of the object the calling code's types promised — e.g.
    // discipline/restore-suspension.ts's re-read of a member's
    // membership_status after a status change, which made the
    // "restore back to active" branch never fire because
    // `memberRow.membership_status` was undefined on the array, never
    // `"suspended"`. Routing through the same sendRepresentation() used by
    // POST/PATCH makes this mock behave like real PostgREST for every
    // request method, not just mutations.
    return sendRepresentation(req, res, result);
  }

  if (restMatch && req.method === "POST") {
    const table = restMatch[1];
    const body = await readJsonBody(req);
    const inputs = Array.isArray(body) ? body : [body];
    const now = new Date().toISOString();
    if (!dataset[table]) dataset[table] = [];
    const inserted = inputs.map((input) => {
      const row = { id: randomUUID(), is_active: true, is_current: true, created_at: now, updated_at: now, ...input };
      dataset[table].push(row);
      return row;
    });
    return sendRepresentation(req, res, inserted);
  }

  if (restMatch && req.method === "PATCH") {
    const table = restMatch[1];
    const body = await readJsonBody(req);
    const now = new Date().toISOString();
    const rows = dataset[table] ?? [];
    const matched = queryTable(rows, url.searchParams);
    for (const row of matched) {
      Object.assign(row, body, { updated_at: now });
    }
    return sendRepresentation(req, res, matched);
  }

  if (restMatch && req.method === "DELETE") {
    const table = restMatch[1];
    const rows = dataset[table] ?? [];
    const matched = queryTable(rows, url.searchParams);
    const matchedIds = new Set(matched.map((row) => row.id));
    dataset[table] = rows.filter((row) => !matchedIds.has(row.id));
    return sendRepresentation(req, res, matched);
  }

  return send(res, 501, { error: "unmocked_gotrue_endpoint", path: url.pathname, method: req.method });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock-gotrue-server listening on http://127.0.0.1:${PORT}`);
});
