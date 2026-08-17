import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/auth/AuthProvider";

/** A signed-in user has no business seeing the login screen. */
export default function AuthGroupLayout() {
  const { status } = useAuth();

  if (status === "signedIn") {
    return <Redirect href="/(app)/dashboard" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
