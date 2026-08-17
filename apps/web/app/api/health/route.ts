import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@ngc/db";

/**
 * Phase 15 (Deployment) — ARCHITECTURE.md §17's "uptime/error monitoring on
 * both the web app and Edge Functions" bullet. An external uptime monitor
 * (whatever the hosting provider or a third-party service like
 * UptimeRobot/Better Stack ends up being — see docs/DEPLOYMENT.md's
 * "Monitoring" section for that still-open provider choice) pings this
 * endpoint on an interval and alerts on a non-200 or a timeout.
 *
 * Deliberately checks real Postgres connectivity through Supabase's REST
 * layer (not just "did this Next.js process boot") — a query against
 * `system_settings` (small, always-seeded reference data, per
 * supabase/seed/001_reference_data.sql) using the service-role client
 * (bypasses RLS; this endpoint isn't testing authorization, just "is the
 * database actually reachable and answering queries") is the cheapest real
 * proxy for "is the whole stack actually up," not just the web tier alone.
 *
 * No caller identity, session, or request body is used — this is a public,
 * unauthenticated endpoint by design (an external monitor has no Supabase
 * session), so it's listed in middleware.ts's PUBLIC_PATHS. It returns only
 * a fixed-shape status object, never a stack trace or connection string, so
 * it's safe to leave publicly reachable in production.
 */
export async function GET() {
  try {
    const supabase = getSupabaseServiceRoleClient();
    const { error } = await supabase.from("system_settings").select("id").limit(1);
    if (error) {
      return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
    }
    return NextResponse.json({ status: "ok", database: "reachable", timestamp: new Date().toISOString() }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
