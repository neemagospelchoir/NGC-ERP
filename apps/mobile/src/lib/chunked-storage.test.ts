import { test } from "node:test";
import assert from "node:assert/strict";
import { createChunkedStorage, type KeyValueBackend } from "./chunked-storage";

/**
 * Tests `createChunkedStorage` directly against an in-memory fake backend.
 * Deliberately does NOT import secure-storage.ts (the real, SecureStore-
 * bound export) — that file imports `expo-secure-store`, which transitively
 * pulls in `react-native`'s own Flow-syntax source, which `tsx --test`'s
 * plain-Node/esbuild transform cannot parse at all (confirmed: an earlier
 * version of this test imported the logic from secure-storage.ts directly
 * and failed at import time with `Unexpected "typeof"` inside
 * react-native/index.js). This is a real, standing constraint of this
 * sandbox — no device/emulator/Metro runtime to execute native-module-
 * touching code in (docs/PHASE_12_1.md S6) — not a workaround for a bug.
 * Importing straight from chunked-storage.ts (zero RN/Expo imports) avoids
 * it entirely while still exercising every line of the real algorithm —
 * chunking, reassembly, stale-chunk cleanup, partial-eviction handling.
 */
function fakeBackend(): KeyValueBackend & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItemAsync: async (key) => store.get(key) ?? null,
    setItemAsync: async (key, value) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key) => {
      store.delete(key);
    },
  };
}

test("round-trips a value smaller than one chunk", async () => {
  const storage = createChunkedStorage(fakeBackend());
  await storage.setItem("small", "hello world");
  assert.equal(await storage.getItem("small"), "hello world");
});

test("round-trips a value spanning many chunks (simulated large session JWT)", async () => {
  const storage = createChunkedStorage(fakeBackend());
  const big = "x".repeat(1800 * 3 + 42); // forces 4 chunks at CHUNK_SIZE=1800
  await storage.setItem("big", big);
  assert.equal(await storage.getItem("big"), big);
});

test("shrinking a value deletes the now-stale trailing chunks", async () => {
  const backend = fakeBackend();
  const storage = createChunkedStorage(backend);
  const big = "y".repeat(1800 * 3);
  await storage.setItem("shrink", big);
  await storage.setItem("shrink", "short");

  assert.equal(await storage.getItem("shrink"), "short");
  // The stale chunk keys from the larger write must actually be gone, not
  // just unreferenced — otherwise they'd sit in the Keychain/Keystore
  // forever, which is exactly the leak this test guards against.
  assert.equal(backend.store.has("shrink__chunk_1"), false);
  assert.equal(backend.store.has("shrink__chunk_2"), false);
});

test("getItem returns null for a key that was never set", async () => {
  const storage = createChunkedStorage(fakeBackend());
  assert.equal(await storage.getItem("never-set"), null);
});

test("removeItem clears the manifest and every chunk", async () => {
  const backend = fakeBackend();
  const storage = createChunkedStorage(backend);
  await storage.setItem("removable", "z".repeat(1800 * 2));
  await storage.removeItem("removable");

  assert.equal(await storage.getItem("removable"), null);
  assert.equal(backend.store.has("removable__chunks"), false);
  assert.equal(backend.store.has("removable__chunk_0"), false);
  assert.equal(backend.store.has("removable__chunk_1"), false);
});

test("getItem treats a partially-evicted chunk set as no session, not a corrupt reassembly", async () => {
  const backend = fakeBackend();
  const storage = createChunkedStorage(backend);
  await storage.setItem("partial", "a".repeat(1800 * 2 + 10));
  // Simulate the OS reclaiming one chunk out from under the manifest.
  backend.store.delete("partial__chunk_1");

  assert.equal(await storage.getItem("partial"), null);
});
