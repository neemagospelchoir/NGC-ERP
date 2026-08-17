import { redirect } from "next/navigation";
import { auth } from "@ngc/services";
import { Avatar, Button, type NavGroupDef } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";
import { SidebarNav } from "./sidebar-nav";

function buildNavGroups(permissionCodes: string[]): NavGroupDef[] {
  const canReadApplications = permissionCodes.includes("members.applications.read") || permissionCodes.includes("members.applications.manage");
  const canReadDiscipline = permissionCodes.includes("discipline.cases.read") || permissionCodes.includes("discipline.cases.manage");
  const canReadInvitations =
    permissionCodes.includes("events.invitations.read") ||
    permissionCodes.includes("events.invitations.manage") ||
    permissionCodes.includes("technical.events.manage");
  const canReadApprovals = permissionCodes.includes("management.approvals.read_all") || permissionCodes.includes("management.approvals.manage");
  const canReadVendors = permissionCodes.includes("logistics.vendors.manage") || permissionCodes.includes("finance.vendors.manage");
  const canReadAssets =
    permissionCodes.includes("inventory.assets.manage") ||
    permissionCodes.includes("inventory.categories.manage") ||
    permissionCodes.includes("technical.equipment.assign");
  const canReadGatePasses = permissionCodes.includes("inventory.gate_passes.manage") || permissionCodes.includes("inventory.gate_passes.read");
  const canReadProcurement = permissionCodes.includes("finance.procurement.manage") || permissionCodes.includes("finance.expenses.manage");
  return [
    {
      key: "overview",
      label: "Overview",
      items: [{ key: "dashboard", label: "Dashboard", href: "/dashboard" }],
    },
    {
      key: "directory",
      label: "Directory",
      items: [
        { key: "members", label: "Members", href: "/members" },
        { key: "departments", label: "Departments", href: "/departments" },
        { key: "families", label: "Families", href: "/families" },
      ],
    },
    {
      key: "onboarding",
      label: "Onboarding",
      items: [
        { key: "applications", label: "Applications", href: "/applications", visible: canReadApplications },
        { key: "probation", label: "Probation", href: "/probation", visible: canReadApplications },
      ],
    },
    {
      key: "attendance-leave",
      label: "Attendance & Leave",
      // Always visible, unlike Onboarding's permission-gated items — RLS
      // (0006) already scopes both Attendance and Leave down to "my own
      // records" for anyone without a manage/read-all permission or a
      // department-scoped role, so every signed-in member has a legitimate
      // reason to see their own attendance history and submit/track a
      // leave request here.
      items: [
        { key: "attendance", label: "Attendance", href: "/attendance" },
        { key: "leave", label: "Leave", href: "/leave" },
      ],
    },
    {
      key: "discipline",
      label: "Discipline",
      // Unlike Attendance & Leave, this group IS permission-gated —
      // Discipline is a confidential module (spec S33/S53): only
      // discipline.cases.read/.manage holders (the Discipline Manager
      // role) see it at all, not "everyone, scoped to their own." See
      // discipline/page.tsx's own doc comment for the matching in-page
      // guard against a direct URL visit.
      items: [{ key: "discipline", label: "Cases", href: "/discipline", visible: canReadDiscipline }],
    },
    {
      key: "events",
      label: "Events & Invitations",
      // Gated on the staff-facing permissions named in the PRD's
      // Permission Matrix (§6), not on the broader "any signed-in user"
      // RLS baseline these tables use for internal transparency — see
      // invitations/page.tsx's own doc comment.
      items: [
        { key: "invitations", label: "Invitations", href: "/invitations", visible: canReadInvitations },
        { key: "events", label: "Events", href: "/events", visible: canReadInvitations },
      ],
    },
    {
      key: "approvals",
      label: "Approvals",
      // PRD §7.29/§9.5's cross-module Approval Center — visible to anyone
      // holding management.approvals.read_all/.manage (Secretary,
      // Chairman/Vice Chairman, HR Deputy Secretary, Technical Manager,
      // Finance Manager, Super Admin per the seed grants). A user who
      // holds neither still lands on a page that correctly shows nothing
      // if they somehow navigate there directly — this nav gate is a
      // convenience, not the access boundary (workflow_instances_select_
      // scoped RLS is).
      items: [{ key: "approvals", label: "Approval Center", href: "/approvals", visible: canReadApprovals }],
    },
    {
      key: "operations",
      label: "Operations",
      // Phase 8.1: Vendors and Inventory/Assets. Gated on the roles the
      // PRD's Permission Matrix (§6) and the seed's actual role_permissions
      // grants agree on today (Logistics/Finance for Vendors; Inventory
      // Officer/Technical Manager for Assets) — see docs/PHASE_8_1.md §4
      // for the one PRD-vs-seed gap this does NOT paper over (Department
      // Leader's "Read" entitlement on Inventory/Assets has no matching
      // permission grant yet).
      items: [
        { key: "vendors", label: "Vendors", href: "/vendors", visible: canReadVendors },
        { key: "assets", label: "Assets", href: "/assets", visible: canReadAssets },
        // Phase 8.2: Uniforms — always visible, unlike Vendors/Assets.
        // uniform_assignments_select_scoped RLS (0012) legitimately lets
        // every member see their own issued items, the same "everyone has
        // a real reason to be here" shape as Attendance & Leave — not a
        // gated management tool like Vendors/Assets.
        { key: "uniforms", label: "Uniforms", href: "/uniforms" },
        // Phase 8.3: Gate Passes — gated like Vendors/Assets (Technical
        // Manager/Inventory Officer/Secretary per the seed's
        // inventory.gate_passes.manage/.read grants), not always-visible
        // like Uniforms — no ordinary member has a self-service reason to
        // browse the gate pass registry (see docs/PHASE_8_3.md).
        { key: "gate-passes", label: "Gate Passes", href: "/gate-passes", visible: canReadGatePasses },
      ],
    },
    {
      key: "technical",
      label: "Technical",
      // Phase 8.4: Technical Rider + Playlist — both always visible, unlike
      // Vendors/Assets/Gate Passes. `technical_riders_select_internal` RLS
      // (0009) lets any signed-in user read every rider outright, and
      // `playlists_select_scoped` legitimately scopes a non-manager caller
      // down to playlists for events they participate in — the same
      // "everyone has a real reason to be here" shape as Uniforms/
      // Attendance & Leave, not a gated management tool. See
      // docs/PHASE_8_4.md.
      items: [
        { key: "technical-riders", label: "Technical Riders", href: "/technical-riders" },
        { key: "playlists", label: "Playlists", href: "/playlists" },
      ],
    },
    {
      key: "logistics",
      label: "Logistics",
      // Phase 8.5: Trips + Itineraries — always visible, same reasoning as
      // Technical Riders: `trips_select_internal`/`itineraries_select_
      // internal` RLS (0013) let any signed-in user read every row, with no
      // narrower scoping at all today (broader than PRD §6's "Read
      // (assigned trip)" intent for a plain member — see docs/PHASE_8_5.md
      // §7). Only creating/editing trips and itineraries is gated on
      // `logistics.trips.manage`.
      items: [{ key: "trips", label: "Trips", href: "/trips" }],
    },
    {
      key: "finance",
      label: "Finance",
      // Phase 9.1: Contributions — always visible, same reasoning as
      // Uniforms/Technical Riders/Trips: `contribution_campaigns_select_
      // internal` RLS (0014) lets any signed-in user read every campaign,
      // and `contribution_records_select_scoped` legitimately lets every
      // member see their OWN contribution history (self-row clause) —
      // Uniforms' "My uniform issues" shape, not a gated management tool.
      // Only campaign creation/editing/status changes and recording a
      // contribution are gated on `finance.contributions.manage`, in-page.
      // Phase 9.2: Expenses — also always visible, the same "everyone has a
      // real reason to be here" shape as Attendance & Leave (not Vendors/
      // Gate Passes, which have none): `expense_requests_insert_self`/
      // `_select_scoped` RLS (0014) let any signed-in user create and read
      // their OWN requests. The full cross-member list/approval-decision UI
      // is additionally shown, in-page, to `finance.expenses.manage`/
      // `.approve` holders or whoever the current approval step names.
      // Phase 9.3: Procurement — gated like Vendors/Gate Passes/Assets, NOT
      // always-visible like Contributions/Expenses, since it has no
      // self-service angle at all: `procurement_requests_select_finance`/
      // `purchase_orders_select_finance` RLS (0014) grant read to
      // `finance.procurement.manage` OR `finance.expenses.manage`, write to
      // `finance.procurement.manage` alone.
      items: [
        { key: "contributions", label: "Contributions", href: "/contributions" },
        { key: "expenses", label: "Expenses", href: "/expenses" },
        { key: "procurement", label: "Procurement", href: "/procurement", visible: canReadProcurement },
      ],
    },
    {
      key: "communications",
      label: "Communications",
      // Phase 10.1: Announcements — always visible, same reasoning as
      // Uniforms/Technical Riders/Contributions: `announcements_select_
      // published` RLS (0016, widened by 0032) lets any signed-in user
      // read every currently-live announcement. Only posting/editing/
      // deleting is gated, in-page, on `communications.announcements.
      // manage`.
      //
      // Phase 10.2: Notifications — also always visible, the same "everyone
      // has a real reason to be here" shape: `notifications_select_own` RLS
      // (0016) lets any signed-in user read their own notifications. The
      // composer/template-management links are shown in-page, gated on
      // `communications.notifications.send`/`.templates.manage`.
      //
      // Phase 10.3: Calendar — also always visible; PRD §7.23 describes it
      // as a "unified institutional calendar" for the whole choir, not a
      // manager tool. It reads three pre-existing, independently-RLS-
      // governed sources (events, attendance_sessions, contribution_
      // campaigns) through their own existing service functions, so a
      // plain member sees exactly what their own department/read scope
      // already permits on the Attendance and Events pages — this view
      // adds no new access, only a merged read.
      //
      // Phase 10.4: Agenda & Voting — also always visible: `agendas_
      // select_authenticated` RLS (0017) lets any signed-in user read
      // every agenda item, and every member is a potential voter on at
      // least the default `all_members` scope. Creating/editing an agenda
      // item is gated in-page on `management.agenda.manage`; individual
      // ballots are only ever shown to that permission's holders on a
      // NON-anonymous item, matching `votes_select_own_or_admin` RLS
      // (tightened by 0034) exactly.
      items: [
        { key: "announcements", label: "Announcements", href: "/announcements" },
        { key: "notifications", label: "Notifications", href: "/notifications" },
        { key: "calendar", label: "Calendar", href: "/calendar" },
        { key: "agendas", label: "Agenda & Voting", href: "/agendas" },
      ],
    },
    {
      key: "media",
      label: "Media",
      // Phase 11: Media — always visible, the same "everyone has a real
      // reason to be here" shape as Announcements/Calendar:
      // `media_links_select_scoped` RLS (0016, widened by 0035) lets any
      // signed-in user (and, once published, even a fully anonymous
      // visitor — see 0035's own doc comment on the public `/media`
      // marketing page named in ARCHITECTURE.md) read a published item,
      // matching PRD §6's "Choir Member: Read (published)" exactly.
      // Creating/editing/deleting is shown only to `media.links.manage`
      // holders (Media Department, Super Admin per the seed).
      items: [{ key: "media", label: "Media", href: "/media" }],
    },
    {
      key: "reports",
      label: "Reports",
      // Phase 13.1: Reporting — always visible, with no `visible:` gate at
      // all, unlike Approvals/Discipline/Onboarding. Every report
      // definition (packages/services/src/reports/definitions/*.ts)
      // composes pre-existing, already-independently-RLS-scoped service
      // functions (listMembers/listSessions+getSessionRoster/
      // listInvitations) rather than a new raw query, so a caller can
      // never export more through /reports than the live Members/
      // Attendance/Invitations pages already show them — the export route
      // (reports/export/route.ts) inherits that same scoping. There is no
      // `reports.*` permission in the seed's catalog to gate on, by
      // design: RLS is the real boundary here, this nav entry is a
      // convenience, same shape as Uniforms/Technical Riders/Contributions
      // above. See docs/PHASE_13_1.md §4.
      items: [{ key: "reports", label: "Reports", href: "/reports" }],
    },
  ];
}

/**
 * Layer 3 of the auth defense-in-depth (RLS is Layer 1; middleware.ts is
 * Layer 2): every (erp) route re-resolves the signed-in user server-side
 * and redirects to /login if there isn't one, rather than trusting that
 * middleware always ran first (e.g. a future rewrite/matcher change).
 * Everything under app/(erp)/* is protected by virtue of living here —
 * new modules should be added as children of this group, not re-implement
 * their own auth check.
 */
export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const user = await auth.getCurrentUserWithRoles(supabase);

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/*
       * Phase 14.3 accessibility audit: WCAG 2.1 SC 2.4.1 (Bypass Blocks,
       * Level A) — without this, a keyboard-only user had to tab through
       * every item in the entire primary nav (SidebarNav, often 15+ links)
       * on EVERY single page before ever reaching that page's own content.
       * `sr-only` hides it visually until it receives keyboard focus (the
       * standard skip-link pattern), at which point `focus:not-sr-only`
       * reveals it as the very first focus stop on the page (it's the
       * first element in DOM order, before SidebarNav). Targets the
       * `id="main-content"` on <main> below; `tabIndex={-1}` there makes an
       * element that is not natively focusable (a <main>, not a link/
       * button) a valid focus target for the browser to jump to.
       */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <SidebarNav groups={buildNavGroups(user.permissionCodes)} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-hairline bg-surface px-6 py-3">
          <span className="text-sm font-semibold text-ink-primary">Neema Gospel Choir — ERP</span>
          <div className="flex items-center gap-3">
            <Avatar name={user.displayName} size="sm" />
            <span className="text-sm text-ink-secondary">{user.displayName}</span>
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 p-6 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
