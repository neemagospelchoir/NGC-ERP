import { QueryClient } from "@tanstack/react-query";

/**
 * ARCHITECTURE.md names React Query as the shared state/data-fetching layer
 * for BOTH web and mobile ("consistent caching/offline-friendly data
 * layer") — this is mobile's first use of it (12.1 built its own simple
 * `useEffect`-based fetch for the dashboard's attendance summary; 12.2's
 * read-mostly screens — Leave, Events/Calendar, Announcements,
 * Notifications — are exactly the case React Query is meant for here).
 *
 * `staleTime` is deliberately non-zero: these are read-mostly lists (S18
 * names announcements, calendar, own profile, constitution as the
 * "read-mostly" category persisted-cache is for), not live dashboards —
 * refetching on every screen focus would defeat the point of caching for a
 * user on a slow or intermittent connection. `refetchOnReconnect: true`
 * (the default) is what actually matters for a mobile client: when
 * connectivity returns after a dead spot, the next screen focus gets fresh
 * data automatically rather than silently keeping stale content.
 *
 * NOTE: this is the in-memory cache only — no persisted-cache-to-disk layer
 * (e.g. `@tanstack/query-async-storage-persister`) is wired up yet, so a
 * full app restart loses the cache and refetches from scratch. ARCHITECTURE
 * S18's "offline/last updated" indicator for read-mostly data (so a user
 * mid-flight or in a dead zone still sees their last-known announcements/
 * calendar rather than a blank loading screen) is therefore not fully
 * built this phase — named as an open item in docs/PHASE_12_2.md rather
 * than silently left out. The ONE write path this phase makes genuinely
 * offline-capable is attendance capture (src/lib/attendance-queue.ts),
 * exactly matching S18's own "attendance capture is the ONLY write-path
 * supported offline" scope line.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});
