"use client";

import { usePathname } from "next/navigation";
import { Sidebar, type NavGroupDef } from "@ngc/ui";

/**
 * Thin client wrapper so <Sidebar> can highlight whichever section the
 * user is actually on. layout.tsx itself must stay a Server Component (it
 * resolves the signed-in user before rendering), so the pathname-aware bit
 * is isolated to this one small client boundary rather than the whole
 * layout. Falls back to a prefix match (not just exact) so a detail page
 * like /members/<id> still highlights the "Members" nav item.
 */
export function SidebarNav({ groups }: { groups: NavGroupDef[] }) {
  const pathname = usePathname();
  const activeHref =
    groups
      .flatMap((g) => g.items)
      .map((item) => item.href)
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? pathname;

  return <Sidebar groups={groups} activeHref={activeHref} />;
}
