import * as SecureStore from "expo-secure-store";
import { createChunkedStorage, type KeyValueBackend } from "./chunked-storage";

/**
 * A Supabase `auth.storage` adapter backed by `expo-secure-store` (iOS
 * Keychain / Android Keystore) instead of `@react-native-async-storage/
 * async-storage`. AsyncStorage is plain, unencrypted on-device storage — a
 * security review of this phase (docs/PHASE_12_1.md S4) correctly flagged
 * that as a real hardening gap for an ERP session token (access + refresh
 * JWT) sitting on a member's phone: readable via a backup extraction, a
 * rooted/jailbroken device, or another app's storage on a compromised
 * device. SecureStore uses the platform's dedicated secure-credential
 * primitive instead.
 *
 * The chunking algorithm that works around SecureStore's ~2048-byte
 * Android value cap lives in ./chunked-storage.ts, kept deliberately free
 * of any `expo-secure-store`/`react-native` import so it stays unit-
 * testable in this sandbox (see that file's own comment for why). This
 * file is just the thin wiring of that algorithm to the real native
 * module — not unit-tested itself, exercised only by the `expo export`
 * bundling step and (eventually) manual on-device verification, the same
 * "some things this sandbox genuinely cannot verify" honesty this
 * codebase applies elsewhere (docs/AUTHENTICATION.md S4's mock-server
 * rationale; docs/PHASE_12_1.md S6).
 */
const secureStoreBackend: KeyValueBackend = {
  getItemAsync: SecureStore.getItemAsync,
  setItemAsync: SecureStore.setItemAsync,
  deleteItemAsync: SecureStore.deleteItemAsync,
};

export const secureChunkedStorage = createChunkedStorage(secureStoreBackend);
