import AsyncStorage from "@react-native-async-storage/async-storage";
import { attendance } from "@ngc/services";
import { createAttendanceQueue, type QueuedAttendanceRecord } from "./attendance-queue-core";
import { getSupabaseClient } from "./supabase";

/**
 * The real, on-device wiring of attendance-queue-core.ts's pure logic:
 * `AsyncStorage` for local persistence (fine here — unlike the Supabase
 * session in secure-storage.ts, a queued attendance record carries no
 * credential, so it doesn't need Keychain/Keystore-level protection) and
 * `attendance.syncOfflineAttendance` (unchanged from `@ngc/services`) as
 * the sync function. Not unit-tested itself — see attendance-queue-core.ts's
 * own comment for why (AsyncStorage transitively pulls in react-native's
 * Flow-syntax source, same as expo-secure-store).
 */
const STORAGE_KEY = "ngc-mobile:attendance-offline-queue";

async function getQueue(): Promise<QueuedAttendanceRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupt cache entry must not crash queue reads forever — treat it
    // as empty (losing at most whatever was pending) rather than throwing
    // on every subsequent app launch.
    return [];
  }
}

async function setQueue(records: QueuedAttendanceRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateIdempotencyKey(): string {
  // Uniqueness, not unpredictability, is what an idempotency key needs —
  // this never gates access to anything, it only deduplicates this
  // device's own retried writes (see sync-offline.ts). Date.now() +
  // Math.random() is sufficient; no need for a cryptographic UUID library.
  return `mob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const attendanceQueue = createAttendanceQueue({ getQueue, setQueue }, generateIdempotencyKey);

export function flushAttendanceQueue() {
  const client = getSupabaseClient();
  return attendanceQueue.flush((record) =>
    attendance.syncOfflineAttendance(client, {
      sessionId: record.sessionId,
      memberId: record.memberId,
      statusCode: record.statusCode,
      notes: record.notes,
      recordedBy: record.recordedBy,
      clientIdempotencyKey: record.clientIdempotencyKey,
    })
  );
}
