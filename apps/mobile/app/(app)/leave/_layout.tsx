import { Stack } from "expo-router";
import { useTheme } from "../../../src/theme/useTheme";

export default function LeaveStackLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceRaised },
        headerTitleStyle: { color: colors.textPrimary },
        headerTintColor: colors.brandPrimary700,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Leave" }} />
      <Stack.Screen name="new" options={{ title: "Request leave", presentation: "modal" }} />
    </Stack>
  );
}
