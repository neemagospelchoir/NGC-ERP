import type { SelectOption } from "@ngc/ui";
import type { media } from "@ngc/services";

const LINK_TYPE_LABEL: Record<media.MediaLinkType, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  google_drive: "Google Drive",
  livestream: "Livestream",
  press_release: "Press release",
  other: "Other",
};

export function linkTypeLabel(type: media.MediaLinkType): string {
  return LINK_TYPE_LABEL[type] ?? type;
}

export const LINK_TYPE_OPTIONS: SelectOption[] = Object.entries(LINK_TYPE_LABEL).map(([value, label]) => ({ value, label }));
