import { useColorScheme } from "react-native";
import { darkColors, lightColors, radius, spacing } from "./tokens";

/**
 * `automatic` in app.json's `userInterfaceStyle` means React Native's own
 * `useColorScheme()` reflects the OS setting directly — unlike the web app,
 * which deliberately requires an explicit, persisted `data-theme="dark"`
 * toggle rather than an automatic `prefers-color-scheme` flip (see
 * tokens.css's own comment on why). Mobile does not have that same
 * discipline yet: there is no persisted user preference or explicit toggle
 * screen in this phase, so it follows the OS setting directly. Flagged as a
 * deliberate, smaller scope than web's theme system, not an oversight — see
 * docs/PHASE_12_1.md S7 (open items).
 */
export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? darkColors : lightColors;
  return { colors, radius, spacing, scheme: scheme ?? "light" };
}
