import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { auth } from "@ngc/services";
import { getSupabaseClient } from "../lib/supabase";

/**
 * Thin React wrapper around `@ngc/services`' auth module — every real
 * decision (what "signed in" means, how to sign in/out, how roles/
 * permissions are resolved) lives in the shared, framework-agnostic
 * service layer, exactly as ARCHITECTURE.md S3 requires ("Web and mobile
 * are two clients of the same API/service layer"). This file only adapts
 * that to React state + Supabase's `onAuthStateChange` listener, which has
 * no web equivalent used elsewhere in this codebase (the web app resolves
 * the session fresh per request via SSR instead).
 */

// `@ngc/services` re-exports each module as a namespace (`export * as auth
// from "./auth"`, packages/services/src/index.ts) rather than flattening
// every named export to the package root — so this type is derived from the
// function's own return type instead of a (non-existent) top-level
// `AuthenticatedUser` export.
export type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof auth.getCurrentUserWithRoles>>>;

interface AuthState {
  status: "loading" | "signedOut" | "signedIn";
  user: AuthenticatedUser | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadUser() {
    const client = getSupabaseClient();
    const current = await auth.getCurrentUserWithRoles(client);
    setUser(current);
    setStatus(current ? "signedIn" : "signedOut");
  }

  useEffect(() => {
    loadUser().catch(() => {
      // A load failure (e.g. transient network error while resolving
      // roles) should not strand the user on a permanent loading screen —
      // treat it as signed-out and let them retry via the login screen,
      // same "fail closed, not stuck" shape as the web middleware guard.
      setUser(null);
      setStatus("signedOut");
    });

    const client = getSupabaseClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      loadUser().catch(() => {
        setUser(null);
        setStatus("signedOut");
      });
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      error,
      async signIn(email: string, password: string) {
        setError(null);
        try {
          await auth.signInWithPassword(getSupabaseClient(), { email, password });
          await loadUser();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not sign in.");
          throw err;
        }
      },
      async signOut() {
        await auth.signOut(getSupabaseClient());
        setUser(null);
        setStatus("signedOut");
      },
      async refresh() {
        await loadUser();
      },
    }),
    [status, user, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used within <AuthProvider>.");
  }
  return ctx;
}
