"use client";

import * as React from "react";
import { cn } from "../utils/cn";

export interface NavItemDef {
  key: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  /** Composed from the same permission model as Phase 4's RLS/has_permission
   * — a NavItem the user cannot access should never be passed to <Sidebar>
   * in the first place; this is not itself an access-control mechanism. */
  visible?: boolean;
}

export interface NavGroupDef {
  key: string;
  label: string;
  items: NavItemDef[];
}

export interface SidebarProps {
  groups: NavGroupDef[];
  activeHref: string;
  onNavigate?: (href: string) => void;
  collapsed?: boolean;
}

/**
 * Internal ERP primary navigation (spec S8.1). Only renders NavItems marked
 * visible — the caller is expected to have already resolved visibility from
 * the signed-in user's permissions (ARCHITECTURE S5.3), so nav and data
 * access can never silently drift apart.
 */
export function Sidebar({ groups, activeHref, onNavigate, collapsed = false }: SidebarProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "flex h-full flex-col gap-4 overflow-y-auto bg-brand-900 py-4 text-white",
        collapsed ? "w-16 px-2" : "w-64 px-3"
      )}
    >
      {groups.map((group) => (
        <div key={group.key}>
          {!collapsed && (
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">
              {group.label}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items
              .filter((item) => item.visible !== false)
              .map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <li key={item.key}>
                    <a
                      href={item.href}
                      onClick={(e) => {
                        if (onNavigate) {
                          e.preventDefault();
                          onNavigate(item.href);
                        }
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "border-l-2 border-accent-400 bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {item.icon && (
                        <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center">
                          {item.icon}
                        </span>
                      )}
                      {!collapsed && <span>{item.label}</span>}
                    </a>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
