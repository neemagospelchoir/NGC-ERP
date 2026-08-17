import type { attendance } from "@ngc/services";

type ExistingAttendanceSnapshot = attendance.ExistingAttendanceSnapshot;
type SyncOfflineAttendanceResult = attendance.SyncOfflineAttendanceResult;

/**
 * Pure offline-queue logic for attendance capture (ARCHITECTURE.md S18),
 * deliberately free of any `AsyncStorage`/`react-native` import — same
 * reasoning as chunked-storage.ts vs. secure-storage.ts: importing a native
 * module transitively pulls in `react-native`'s own Flow-syntax source,
 * which `tsx --test` cannot parse, so the actual queue algorithm lives here
 * (testable against a plain in-memory fake) and attendance-queue.ts is the
 * thin thirteen-line wiring of this to the real `AsyncStorage` + Supabase
 * client, exercised only by `expo export` and (eventually) on-device
 * verification — see docs/PHASE_12_2.md S6.
 *
 * `flush()`'s contract mirrors `syncOfflineAttendance`'s own three
 * outcomes exactly, so nothing is silently dropped: a genuine conflict or a
 * vanished session is returned to the caller to show the user, not
 * retried forever or discarded; anything that fails for another reason
 * (most commonly: still offline) stays queued for the next flush attempt.
 */
export interface QueuedAttendanceRecord {
  sessionId: string;
  memberId: string;
  statusCode: string;
  notes: string | null;
  recordedBy: string;
  clientIdempotencyKey: string;
  queuedAt: string;
}

export interface QueueStorage {
  getQueue(): Promise<QueuedAttendanceRecord[]>;
  setQueue(records: QueuedAttendanceRecord[]): Promise<void>;
}

export type SyncFn = (record: QueuedAttendanceRecord) => Promise<SyncOfflineAttendanceResult>;

export interface FlushOutcome {
  synced: QueuedAttendanceRecord[];
  conflicts: Array<{ record: QueuedAttendanceRecord; existing: ExistingAttendanceSnapshot }>;
  sessionsNotFound: QueuedAttendanceRecord[];
  stillQueued: QueuedAttendanceRecord[];
}

export function createAttendanceQueue(storage: QueueStorage, generateId: () => string) {
  return {
    async enqueue(
      input: Omit<QueuedAttendanceRecord, "clientIdempotencyKey" | "queuedAt">,
      nowIso: string
    ): Promise<QueuedAttendanceRecord> {
      const record: QueuedAttendanceRecord = { ...input, clientIdempotencyKey: generateId(), queuedAt: nowIso };
      const queue = await storage.getQueue();
      await storage.setQueue([...queue, record]);
      return record;
    },

    async getQueue(): Promise<QueuedAttendanceRecord[]> {
      return storage.getQueue();
    },

    /**
     * Attempts every queued record, in order. Each outcome is bucketed and
     * removed from the persisted queue EXCEPT `stillQueued` (transient
     * failures — most commonly "still offline" — which are written back so
     * the next flush call retries them; a crash or app-kill mid-flush loses
     * nothing, since the queue on disk is only ever replaced with the
     * as-of-that-call-complete remainder).
     */
    async flush(sync: SyncFn): Promise<FlushOutcome> {
      const queue = await storage.getQueue();
      const outcome: FlushOutcome = { synced: [], conflicts: [], sessionsNotFound: [], stillQueued: [] };

      for (const record of queue) {
        try {
          const result = await sync(record);
          if (result.outcome === "synced" || result.outcome === "already_synced") {
            outcome.synced.push(record);
          } else if (result.outcome === "conflict") {
            outcome.conflicts.push({ record, existing: result.existing });
          } else {
            outcome.sessionsNotFound.push(record);
          }
        } catch {
          outcome.stillQueued.push(record);
        }
      }

      await storage.setQueue(outcome.stillQueued);
      return outcome;
    },
  };
}
