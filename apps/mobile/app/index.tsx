import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";
import { useTheme } from "../src/theme/useTheme";

/**
 * The app's only unconditional entry point — redirects to the signed-in
 * `(app)` group or the `(auth)` login screen once the initial session
 * check resolves. Kept deliberately dumb (no UI of its own beyond a
 * spinner) so there is exactly one place that decides "where does a cold
 * launch land," instead of duplicating that check in both groups' layouts.
 */
export default function Index() {
  const { status } = useAuth();
  const { colors } = useTheme();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.pagePlane }}>
        <ActivityIndicator color={colors.brandPrimary700} />
      </View>
    );
  }

  return <Redirect href={status === "signedIn" ? "/(app)/dashboard" : "/(auth)/login"} />;
}
