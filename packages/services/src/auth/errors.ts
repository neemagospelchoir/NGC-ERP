/**
 * A single error type for the whole auth service layer, so callers (Server
 * Actions, Route Handlers, Playwright tests) can rely on one shape instead
 * of guessing at Supabase's raw error objects. `cause` retains the original
 * error for logging, but `message` is always something safe to show a user
 * — see mapSupabaseAuthError below for the specific rule that keeps
 * sign-in failures from leaking which part (email vs. password) was wrong.
 */
export class AuthServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AuthServiceError";
    this.cause = cause;
  }
}

/**
 * Supabase Auth (GoTrue) returns an `AuthError`-shaped object with a
 * `message` and often a `status`. We never forward its raw message to the
 * UI verbatim for credential failures — "Invalid login credentials" is fine
 * to show, but some GoTrue messages are more specific ("User not found")
 * and would let an attacker enumerate registered emails. This function is
 * the single place that decides what is safe to surface.
 */
export function mapSupabaseAuthError(error: { message?: string; status?: number } | null | undefined): string {
  const raw = (error?.message ?? "").toLowerCase();

  if (raw.includes("invalid login credentials") || raw.includes("invalid credentials")) {
    return "Incorrect email or password.";
  }
  if (raw.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  if (raw.includes("user not found")) {
    // Deliberately identical to the generic credentials message — do not
    // let this branch leak account existence to the caller.
    return "Incorrect email or password.";
  }
  if (raw.includes("rate limit") || error?.status === 429) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (raw.includes("password") && raw.includes("short")) {
    return "Password is too short. It must be at least 8 characters.";
  }
  if (raw.includes("user already registered") || raw.includes("already been registered")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (raw.includes("username") && (raw.includes("duplicate") || raw.includes("already exists") || raw.includes("unique"))) {
    return "That username is already taken. Please choose another.";
  }
  if (raw.includes("duplicate key") || raw.includes("database error saving new user")) {
    // The self-signup trigger (0041_username_and_self_signup.sql) is the
    // only other thing that can fail during signUp() itself; a duplicate
    // key there is virtually always the username unique constraint, since
    // the email uniqueness case is already caught by "user already
    // registered" above.
    return "That username is already taken. Please choose another, or leave it blank.";
  }
  if (!error?.message) {
    return "Something went wrong. Please try again.";
  }
  // Fall back to the original message for cases we haven't classified yet
  // (e.g. network errors) — better than a useless generic string, and none
  // of GoTrue's other message classes leak account existence.
  return error.message;
}
