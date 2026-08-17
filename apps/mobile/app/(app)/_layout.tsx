import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import { useTheme } from "../../src/theme/useTheme";

/** A signed-out user has no business inside the app shell. */
export default function AppGroupLayout() {
  const { status } = useAuth();
  const { colors } = useTheme();

  if (status === "signedOut") {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: { color: colors.textPrimary },
        headerStyle: { backgroundColor: colors.surfaceRaised },
        tabBarActiveTintColor: colors.brandPrimary700,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surfaceRaised },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard", tabBarIcon: ({ color }) => <Text style={{ color }}>⌂</Text> }}
      />
      <Tabs.Screen
        name="attendance"
        options={{ title: "Attendance", tabBarIcon: ({ color }) => <Text style={{ color }}>✓</Text> }}
      />
      <Tabs.Screen
        name="leave"
        options={{ title: "Leave", tabBarIcon: ({ color }) => <Text style={{ color }}>☐</Text> }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: "Calendar", tabBarIcon: ({ color }) => <Text style={{ color }}>▦</Text> }}
      />
      <Tabs.Screen
        name="contributions"
        options={{ title: "Giving", tabBarIcon: ({ color }) => <Text style={{ color }}>◔</Text> }}
      />
      <Tabs.Screen
        name="voting"
        options={{ title: "Vote", tabBarIcon: ({ color }) => <Text style={{ color }}>◈</Text> }}
      />
      <Tabs.Screen
        name="announcements"
        options={{ title: "News", tabBarIcon: ({ color }) => <Text style={{ color }}>▣</Text> }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ title: "Alerts", tabBarIcon: ({ color }) => <Text style={{ color }}>◉</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color }) => <Text style={{ color }}>◍</Text> }}
      />
    </Tabs>
  );
}
