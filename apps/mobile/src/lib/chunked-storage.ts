/**
 * Pure chunking/reassembly logic, deliberately kept in its own file with
 * ZERO imports from `expo-secure-store` or `react-native` — importing
 * either (even transitively) pulls in `react-native`'s own source, which
 * uses Flow syntax that `tsx`/esbuild's plain-Node transform cannot parse
 * (confirmed: `secure-storage.test.ts` originally imported this logic
 * straight from `secure-storage.ts` and failed at import time with
 * `Unexpected "typeof"` inside react-native/index.js — a real, standing
 * constraint of this sandbox, which has no device/emulator/Metro runtime
 * to execute native-module-touching code in, see docs/PHASE_12_1.md S6).
 * Splitting the actual algorithm out here is what makes it unit-testable
 * at all: `secure-storage.ts` (real, SecureStore-bound, untested-at-unit-
 * level by necessity) just imports and wires this up; `chunked-storage.test.ts`
 * exercises this file directly against a plain in-memory fake backend.
 *
 * See secure-storage.ts for the full rationale on WHY this exists (session
 * tokens need encrypted-at-rest storage, not plain AsyncStorage) and the
 * chunk-size caveat (Android's SecureStore value size cap) this works
 * around.
 */
const CHUNK_SIZE = 1800; // bytes; comfortably under Android's ~2048-byte SecureStore value cap.

export interface KeyValueBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export function createChunkedStorage(backend: KeyValueBackend) {
  const manifestKey = (key: string) => `${key}__chunks`;
  const chunkKey = (key: string, index: number) => `${key}__chunk_${index}`;

  async function readManifest(key: string): Promise<number | null> {
    const raw = await backend.getItemAsync(manifestKey(key));
    if (raw === null) return null;
    const count = Number.parseInt(raw, 10);
    return Number.isFinite(count) && count >= 0 ? count : null;
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const count = await readManifest(key);
      if (count === null) return null;
      if (count === 0) return "";

      const chunks = await Promise.all(Array.from({ length: count }, (_, i) => backend.getItemAsync(chunkKey(key, i))));
      // A partially-written or partially-evicted set of chunks (e.g. the OS
      // reclaimed keychain space, or a crash interrupted a previous
      // setItem) must be treated as "no valid session" rather than
      // silently reassembled with a hole in the middle — the latter would
      // hand Supabase a corrupt token string instead of a clean "please
      // sign in again."
      if (chunks.some((c) => c === null)) return null;
      return chunks.join("");
    },

    async setItem(key: string, value: string): Promise<void> {
      const previousCount = await readManifest(key);

      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }

      await Promise.all(chunks.map((chunk, i) => backend.setItemAsync(chunkKey(key, i), chunk)));
      await backend.setItemAsync(manifestKey(key), String(chunks.length));

      // If the new value needed fewer chunks than the old one, delete the
      // now-stale trailing chunks — otherwise a later getItem for a
      // shrunken manifest count is fine (it only reads `count` chunks),
      // but the orphaned ones would linger in the Keychain/Keystore
      // forever.
      if (previousCount !== null && previousCount > chunks.length) {
        await Promise.all(
          Array.from({ length: previousCount - chunks.length }, (_, i) => backend.deleteItemAsync(chunkKey(key, chunks.length + i)))
        );
      }
    },

    async removeItem(key: string): Promise<void> {
      const count = await readManifest(key);
      if (count === null) return;
      await Promise.all(Array.from({ length: count }, (_, i) => backend.deleteItemAsync(chunkKey(key, i))));
      await backend.deleteItemAsync(manifestKey(key));
    },
  };
}
