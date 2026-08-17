import { test } from "node:test";
import assert from "node:assert/strict";
import { createAttendanceQueue, type QueuedAttendanceRecord, type QueueStorage } from "./attendance-queue-core";
import type { attendance } from "@ngc/services";

type SyncOfflineAttendanceResult = attendance.SyncOfflineAttendanceResult;

function fakeStorage(): QueueStorage & { snapshot(): QueuedAttendanceRecord[] } {
  let records: QueuedAttendanceRecord[] = [];
  return {
    async getQueue() {
      return records;
    },
    async setQueue(next) {
      records = next;
    },
    snapshot() {
      return records;
    },
  };
}

let counter = 0;
function fakeIdGenerator() {
  counter += 1;
  return `id-${counter}`;
}

test("enqueue appends a record with a generated idempotency key and timestamp", async () => {
  const storage = fakeStorage();
  const queue = createAttendanceQueue(storage, fakeIdGenerator);

  const record = await queue.enqueue(
    { sessionId: "s1", memberId: "m1", statusCode: "present", notes: null, recordedBy: "leader-1" },
    "2026-03-01T10:00:00.000Z"
  );

  assert.equal(record.sessionId, "s1");
  assert.equal(record.queuedAt, "2026-03-01T10:00:00.000Z");
  assert.ok(record.clientIdempotencyKey.length > 0);
  assert.equal(storage.snapshot().length, 1);
});

test("flush removes synced and already_synced records from the queue", async () => {
  const storage = fakeStorage();
  const queue = createAttendanceQueue(storage, fakeIdGenerator);
  await queue.enqueue({ sessionId: "s1", memberId: "m1", statusCode: "present", notes: null, recordedBy: "leader-1" }, "2026-03-01T10:00:00.000Z");
  await queue.enqueue({ sessionId: "s1", memberId: "m2", statusCode: "absent", notes: null, recordedBy: "leader-1" }, "2026-03-01T10:00:01.000Z");

  const results: SyncOfflineAttendanceResult[] = [{ outcome: "synced", recordId: "r1" }, { outcome: "already_synced", recordId: "r2" }];
  let call = 0;
  const outcome = await queue.flush(async () => results[call++] as SyncOfflineAttendanceResult);

  assert.equal(outcome.synced.length, 2);
  assert.equal(outcome.stillQueued.length, 0);
  assert.equal(storage.snapshot().length, 0, "the persisted queue must be empty after a full successful flush");
});

test("flush surfaces a conflict rather than dropping it or silently retrying it forever", async () => {
  const storage = fakeStorage();
  const queue = createAttendanceQueue(storage, fakeIdGenerator);
  await queue.enqueue({ sessionId: "s1", memberId: "m1", statusCode: "present", notes: null, recordedBy: "leader-1" }, "2026-03-01T10:00:00.000Z");

  const outcome = await queue.flush(async () => ({
    outcome: "conflict",
    existing: { statusCode: "absent", notes: null, recordedVia: "manual", updatedAt: "2026-03-01T09:00:00.000Z" },
  }));

  assert.equal(outcome.conflicts.length, 1);
  assert.equal(outcome.conflicts[0]?.existing.statusCode, "absent");
  // A conflict is resolved (removed from the retry queue), not left to loop forever unattended.
  assert.equal(storage.snapshot().length, 0);
});

test("flush surfaces a vanished session and removes it from the queue rather than retrying forever", async () => {
  const storage = fakeStorage();
  const queue = createAttendanceQueue(storage, fakeIdGenerator);
  await queue.enqueue({ sessionId: "s-deleted", memberId: "m1", statusCode: "present", notes: null, recordedBy: "leader-1" }, "2026-03-01T10:00:00.000Z");

  const outcome = await queue.flush(async () => ({ outcome: "session_not_found" }));

  assert.equal(outcome.sessionsNotFound.length, 1);
  assert.equal(storage.snapshot().length, 0);
});

test("flush leaves a transient failure (e.g. still offline) queued for the next attempt", async () => {
  const storage = fakeStorage();
  const queue = createAttendanceQueue(storage, fakeIdGenerator);
  await queue.enqueue({ sessionId: "s1", memberId: "m1", statusCode: "present", notes: null, recordedBy: "leader-1" }, "2026-03-01T10:00:00.000Z");

  const outcome = await queue.flush(async () => {
    throw new Error("network request failed");
  });

  assert.equal(outcome.stillQueued.length, 1);
  assert.equal(storage.snapshot().length, 1, "must remain persisted for the next flush() call");
});

test("a mixed batch: one synced, one still-queued after a transient failure, in a single flush", async () => {
  const storage = fakeStorage();
  const queue = createAttendanceQueue(storage, fakeIdGenerator);
  await queue.enqueue({ sessionId: "s1", memberId: "m1", statusCode: "present", notes: null, recordedBy: "leader-1" }, "2026-03-01T10:00:00.000Z");
  await queue.enqueue({ sessionId: "s1", memberId: "m2", statusCode: "present", notes: null, recordedBy: "leader-1" }, "2026-03-01T10:00:01.000Z");

  let call = 0;
  const outcome = await queue.flush(async () => {
    call += 1;
    if (call === 1) return { outcome: "synced", recordId: "r1" };
    throw new Error("offline");
  });

  assert.equal(outcome.synced.length, 1);
  assert.equal(outcome.stillQueued.length, 1);
  assert.equal(storage.snapshot().length, 1);
  assert.equal(storage.snapshot()[0]?.memberId, "m2");
});
