import { Stack } from "expo-router";
import { useTheme } from "../../../src/theme/useTheme";

export default function ProfileStackLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceRaised },
        headerTitleStyle: { color: colors.textPrimary },
        headerTintColor: colors.brandPrimary700,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Profile" }} />
      <Stack.Screen name="qr" options={{ title: "My ID / Scan" }} />
    </Stack>
  );
}
