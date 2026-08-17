import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { ServiceError } from "../shared/errors";
import type { SyncOfflineAttendanceInput, SyncOfflineAttendanceResult } from "./types";

/**
 * The mobile-only counterpart to `recordAttendance` (ARCHITECTURE.md S18:
 * "Attendance capture is the ONLY write-path supported offline"). A mobile
 * client (a department leader or anyone holding
 * `attendance.records.manage`, per `attendance_write_scoped` RLS — a plain
 * member cannot write to this table at all, even for their own record; see
 * this function's own RLS note below) records a roster's statuses locally
 * while offline, each tagged with a client-generated
 * `clientIdempotencyKey`, then calls this function once per queued record
 * on reconnect. Three properties this function guarantees, all required by
 * S18 and none satisfied by `recordAttendance`'s own plain
 * check-then-insert-or-update shape:
 *
 * 1. **Retry-safe, never duplicates.** If the same offline record is synced
 *    twice (e.g. the app crashed after a successful sync but before
 *    clearing its local queue), the second call recognizes its own
 *    previously-written row via the idempotency key and no-ops
 *    (`already_synced`) rather than erroring on the table's own
 *    `unique (session_id, member_id)` constraint or silently overwriting.
 * 2. **A genuine conflict is surfaced, never silently overwritten.** If a
 *    DIFFERENT write already exists for this session+member (recorded by
 *    someone else, or synced from another device, or entered manually via
 *    `recordAttendance` in the interim) — its `client_idempotency_key`
 *    won't match this call's — the existing row is left untouched and its
 *    current state is returned for the caller to show the user a
 *    resolvable conflict, exactly per S18's own wording.
 * 3. **A vanished session is reported, not silently written into.** This
 *    schema has no "cancelled" status on `attendance_sessions` — a session
 *    is either present or (via `on delete cascade` from `attendance`) hard-
 *    deleted, which is the concrete form S18's "session cancelled
 *    meanwhile" scenario takes here. `session_not_found` lets the caller
 *    surface that instead of the write silently vanishing without
 *    explanation.
 *
 * No application-layer permission check beyond what `recordAttendance`
 * already omits — `attendance_write_scoped` RLS (0006) already requires
 * `attendance.records.manage` or the session's department being in the
 * caller's own scope; this function trusts Postgres exactly the same way.
 */
export async function syncOfflineAttendance(
  client: SupabaseClient<Database>,
  input: SyncOfflineAttendanceInput
): Promise<SyncOfflineAttendanceResult> {
  const statusCode = input.statusCode.trim();
  if (!statusCode) {
    throw new ServiceError("An attendance status is required.");
  }
  const clientIdempotencyKey = input.clientIdempotencyKey.trim();
  if (!clientIdempotencyKey) {
    throw new ServiceError("A client idempotency key is required for offline sync — use recordAttendance() for a direct, online write instead.");
  }

  const { data: statusRow, error: statusError } = await client
    .from("lookup_values")
    .select("id")
    .eq("category", "attendance_status")
    .eq("code", statusCode)
    .eq("is_active", true)
    .maybeSingle();
  if (statusError) throw new ServiceError("Could not verify the attendance status.", statusError);
  if (!statusRow) {
    throw new ServiceError(`"${statusCode}" is not a recognized attendance status.`);
  }

  const { data: session, error: sessionError } = await client
    .from("attendance_sessions")
    .select("id")
    .eq("id", input.sessionId)
    .maybeSingle();
  if (sessionError) throw new ServiceError("Could not verify the attendance session.", sessionError);
  if (!session) {
    return { outcome: "session_not_found" };
  }

  const { data: existing, error: existingError } = await client
    .from("attendance")
    .select("id, status_code, notes, recorded_via, client_idempotency_key, updated_at")
    .eq("session_id", input.sessionId)
    .eq("member_id", input.memberId)
    .maybeSingle();
  if (existingError) throw new ServiceError("Could not check existing attendance.", existingError);

  if (existing) {
    if (existing.client_idempotency_key === clientIdempotencyKey) {
      return { outcome: "already_synced", recordId: existing.id };
    }
    return {
      outcome: "conflict",
      existing: {
        statusCode: existing.status_code,
        notes: existing.notes,
        recordedVia: existing.recorded_via,
        updatedAt: existing.updated_at,
      },
    };
  }

  const { data: inserted, error: insertError } = await client
    .from("attendance")
    .insert({
      session_id: input.sessionId,
      member_id: input.memberId,
      status_code: statusCode,
      notes: input.notes ?? null,
      recorded_via: "mobile",
      recorded_by: input.recordedBy,
      client_idempotency_key: clientIdempotencyKey,
    })
    .select("id")
    .single();
  if (insertError) throw new ServiceError("Could not sync attendance.", insertError);

  return { outcome: "synced", recordId: inserted.id };
}
