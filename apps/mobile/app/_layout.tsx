import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth/AuthProvider";
import { queryClient } from "../src/lib/query-client";

/**
 * Root layout. Auth GATING (redirecting a signed-out user away from
 * `(app)`, or a signed-in user away from `(auth)`) happens inside each
 * group's own layout below, not here — mirroring apps/web's own layered
 * shape (a root layout that just provides context, and middleware.ts /
 * each route group's own layout doing the actual guard). expo-router has
 * no server-side middleware equivalent; `(app)/_layout.tsx` and
 * `(auth)/_layout.tsx` are where that logic lives for this app.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
