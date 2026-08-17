import { Stack } from "expo-router";
import { useTheme } from "../../../src/theme/useTheme";

export default function AttendanceStackLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceRaised },
        headerTitleStyle: { color: colors.textPrimary },
        headerTintColor: colors.brandPrimary700,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Attendance" }} />
      <Stack.Screen name="[id]" options={{ title: "Take attendance" }} />
    </Stack>
  );
}
