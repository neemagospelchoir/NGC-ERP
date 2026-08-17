import type { PropsWithChildren } from "react";
import { View, type ViewStyle } from "react-native";
import { useTheme } from "../theme/useTheme";

/**
 * A minimal shared container matching `packages/ui`'s `<Card>` shape
 * (surface-raised background, hairline border, rounded corners) — not a
 * port of that component (it's a React DOM component, unusable in React
 * Native), just the same visual role repeated across 12.2's several new
 * screens instead of re-inlining the same three style properties in each
 * one.
 */
export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceRaised,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.gridline,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
