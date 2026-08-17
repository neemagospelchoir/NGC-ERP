import * as React from "react";
import { cn } from "../utils/cn";

export interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-14 w-14 text-base",
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Member photo with a graceful initials fallback — never a broken-image
 * icon when photoUrl is absent (spec S13 profile photo, applied platform-wide
 * anywhere a member/user is represented). */
export function Avatar({ name, photoUrl, size = "md" }: AvatarProps) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={cn("rounded-pill object-cover", SIZE_CLASSES[size])}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "flex items-center justify-center rounded-pill bg-brand-100 font-semibold text-brand-700",
        SIZE_CLASSES[size]
      )}
    >
      {initialsFrom(name)}
    </span>
  );
}
