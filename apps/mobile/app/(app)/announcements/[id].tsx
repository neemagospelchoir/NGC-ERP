import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Image, ScrollView, Text, View } from "react-native";
import { announcements } from "@ngc/services";
import { getSupabaseClient } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/theme/useTheme";

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();

  const query = useQuery({
    queryKey: ["announcements", "detail", id],
    queryFn: () => announcements.getAnnouncement(getSupabaseClient(), id),
  });

  const item = query.data;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.pagePlane }} contentContainerStyle={{ padding: spacing.lg }}>
      {!item && !query.isLoading && <Text style={{ color: colors.textMuted, fontSize: 13 }}>This announcement is not available.</Text>}
      {item && (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary }}>{item.title}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{item.publishAt.slice(0, 10)}</Text>
          {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 180, borderRadius: 10 }} resizeMode="cover" />
          )}
          <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22 }}>{item.message}</Text>
        </View>
      )}
    </ScrollView>
  );
}
