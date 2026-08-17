/**
 * Generic service-layer error, shared across every module under
 * packages/services (departments, families, members, and onward). Mirrors
 * auth/errors.ts's AuthServiceError (introduced first, in Phase 6, and left
 * as-is rather than refactored onto this shared base — it already has
 * passing tests asserting `instanceof AuthServiceError`, and changing that
 * class's identity now would be a needless risk to working code for a
 * cosmetic consistency gain). New modules should throw this one (or a
 * thin per-module subclass, if a module ever needs to carry extra
 * structured fields) rather than inventing another near-identical class.
 */
export class ServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.cause = cause;
  }
}
