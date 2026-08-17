import { test, expect, type Page } from "@playwright/test";
import { seedMockServer, type MockUser } from "./seed-mock-server";

/**
 * Phase 13.1/13.2 (Reporting) end-to-end verification. Like Calendar
 * (10.3), Reports is a pure read-side aggregation of pre-existing,
 * already-RLS-scoped sources (members, attendance_sessions/attendance,
 * invitations, and — from 13.2 — vendors/disciplinary_cases/etc.) — there
 * is nothing to create/edit/delete here, so this spec covers: a plain
 * member seeing the always-visible Reports nav link with no permission
 * gate, running the Member/Attendance/Invitation reports with period +
 * narrowing filters, the three export links (`/reports/export?...&format=
 * csv|xlsx|pdf`) each actually returning a 200 with the expected
 * Content-Type, one sampled 13.2 report (Vendor, chosen because its
 * financial-field masking is a real security property worth an end-to-end
 * check, not just a unit test against a fake client), and the Discipline
 * Report's UI-layer permission gate (the one report of the fourteen that
 * is genuinely confidential, per spec S33 — see docs/PHASE_13_2.md §2).
 * Exports are exercised via `page.request` (the same authenticated
 * browser session, but a direct HTTP call) rather than a real file-picker
 * download, since what matters here is that the real Route Handler (not a
 * browser download dialog) runs the same RLS-scoped query the on-screen
 * table just rendered.
 */
const MEMBER_USER: MockUser = { id: "user-member-reports", email: "member-reports@ngc.org", password: "CorrectHorse123!", displayName: "Reports Member" };
const DISCIPLINE_USER: MockUser = { id: "user-discipline-reports", email: "discipline-reports@ngc.org", password: "CorrectHorse123!", displayName: "Reports Discipline Manager" };

const SEED_DATA = {
  users: [
    { id: MEMBER_USER.id, email: MEMBER_USER.email, display_name: MEMBER_USER.displayName, is_active: true },
    { id: DISCIPLINE_USER.id, email: DISCIPLINE_USER.email, display_name: DISCIPLINE_USER.displayName, is_active: true },
  ],
  user_roles: [{ user_id: DISCIPLINE_USER.id, role_id: "role-reports-discipline", scope_type: null, scope_id: null, revoked_at: null }],
  roles: [{ id: "role-reports-discipline", code: "discipline_manager_reports", name: "Discipline Manager" }],
  role_permissions: [{ role_id: "role-reports-discipline", permission_id: "perm-reports-disc-read" }],
  permissions: [{ id: "perm-reports-disc-read", code: "discipline.cases.read" }],
  vendor_categories: [{ id: "vcat-reports-1", name: "Sound & Lighting", created_at: "2026-01-01T00:00:00.000Z" }],
  vendors: [
    {
      id: "vendor-reports-1",
      category_id: "vcat-reports-1",
      name: "Kilimanjaro Sound Ltd",
      contact_person: "Juma Ally",
      phone: "0700111222",
      email: "juma@kilimanjarosound.co.tz",
      address: null,
      tax_information: "TIN-9988776",
      bank_payment_information: "CRDB 0123456789",
      performance_notes: null,
      status: "active",
      created_at: "2026-03-05T00:00:00.000Z",
      updated_at: "2026-03-05T00:00:00.000Z",
    },
  ],
  disciplinary_cases: [
    {
      id: "case-reports-1",
      case_number: "DISC-2026-9001",
      member_id: "member-reports-asha",
      category: "conduct",
      incident_date: "2026-03-04",
      description: "Reports e2e fixture case",
      evidence_document_ids: [],
      officer_id: DISCIPLINE_USER.id,
      status: "open",
      created_at: "2026-03-05T00:00:00.000Z",
      updated_at: "2026-03-05T00:00:00.000Z",
    },
  ],
  departments: [{ id: "dept-reports-sopranos", name: "Sopranos", description: null, leader_user_id: null, is_active: true, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }],
  members: [
    {
      id: "member-reports-asha",
      member_number: "NGC-2026-1001",
      first_name: "Asha",
      last_name: "Mwakalinga",
      preferred_name: null,
      photo_url: null,
      membership_status: "active",
      primary_department_id: "dept-reports-sopranos",
      family_id: null,
      joined_at: "2026-03-10",
    },
    {
      id: "member-reports-baraka",
      member_number: "NGC-2026-1002",
      first_name: "Baraka",
      last_name: "Mushi",
      preferred_name: null,
      photo_url: null,
      membership_status: "active",
      primary_department_id: "dept-reports-sopranos",
      family_id: null,
      joined_at: "2025-06-01", // outside the report's March 2026 period
    },
  ],
  attendance_sessions: [
    { id: "session-reports-1", session_type: "rehearsal", title: "March rehearsal", department_id: null, event_id: null, session_date: "2026-03-05", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" },
  ],
  attendance: [
    { id: "att-reports-1", session_id: "session-reports-1", member_id: "member-reports-asha", status_code: "present", notes: null, recorded_via: "manual", created_at: "2026-03-05T00:00:00.000Z", updated_at: "2026-03-05T00:00:00.000Z" },
  ],
  lookup_values: [
    { id: "lv-reports-present", category: "attendance_status", code: "present", label: "Present", sort_order: 1, is_active: true, metadata: { counts_as_present: true } },
    { id: "lv-reports-absent", category: "attendance_status", code: "absent", label: "Absent", sort_order: 2, is_active: true, metadata: { counts_as_present: false } },
  ],
  invitations: [
    {
      id: "inv-reports-1",
      invitation_number: "INV-2026-9001",
      organizer_name: "Grace Fellowship",
      organizer_contact_email: null,
      organizer_contact_phone: null,
      organization_name: null,
      event_name: "Easter Concert",
      event_type: null,
      proposed_date: "2026-04-05",
      proposed_time: null,
      venue: null,
      location: null,
      region: "Dar es Salaam",
      expected_audience: null,
      nature_of_invitation: null,
      performance_requirements: null,
      technical_requirements: null,
      transport_requirements: null,
      accommodation_requirements: null,
      financial_information: null,
      additional_notes: null,
      status: "approved",
      submitted_at: "2026-03-01T00:00:00.000Z",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
    },
  ],
};

async function signIn(page: Page, user: MockUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Phase 13.1: Reports", () => {
  test.beforeEach(async () => {
    await seedMockServer([MEMBER_USER, DISCIPLINE_USER], SEED_DATA as unknown as Parameters<typeof seedMockServer>[1]);
  });

  test("a plain member sees the always-visible Reports nav link and runs the Member Report for its period", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();

    await page.goto("/reports?report=members&period=monthly&year=2026&month=3");
    await expect(page.getByRole("heading", { name: "Member Report" })).toBeVisible();
    await expect(page.getByText("NGC-2026-1001")).toBeVisible();
    await expect(page.getByText("NGC-2026-1002")).toHaveCount(0, {
      // Baraka joined in 2025, outside the March 2026 period — the point
      // of this assertion is that the report's period filter, not just
      // its column set, is actually wired into the on-screen result.
    });
  });

  test("the Attendance Report tallies presence for the resolved period", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/reports?report=attendance&period=monthly&year=2026&month=3");
    await expect(page.getByRole("heading", { name: "Attendance Report" })).toBeVisible();
    await expect(page.getByText("NGC-2026-1001")).toBeVisible();
    await expect(page.getByRole("cell", { name: "100", exact: true })).toBeVisible();
  });

  test("the Invitation Report narrows by status as well as period", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/reports?report=invitations&period=custom&from=2026-01-01&to=2026-12-31&status=approved");
    await expect(page.getByText("INV-2026-9001")).toBeVisible();

    await page.goto("/reports?report=invitations&period=custom&from=2026-01-01&to=2026-12-31&status=declined");
    await expect(page.getByText("INV-2026-9001")).toHaveCount(0);
  });

  test("each export link downloads the matching format with the correct Content-Type", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/reports?report=members&period=monthly&year=2026&month=3");

    const csvHref = await page.getByRole("link", { name: "Download CSV" }).getAttribute("href");
    const xlsxHref = await page.getByRole("link", { name: "Download Excel" }).getAttribute("href");
    const pdfHref = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href");
    expect(csvHref).toContain("format=csv");
    expect(xlsxHref).toContain("format=xlsx");
    expect(pdfHref).toContain("format=pdf");

    const csvResponse = await page.request.get(csvHref as string);
    expect(csvResponse.status()).toBe(200);
    expect(csvResponse.headers()["content-type"]).toContain("text/csv");
    expect(await csvResponse.text()).toContain("NGC-2026-1001");

    const xlsxResponse = await page.request.get(xlsxHref as string);
    expect(xlsxResponse.status()).toBe(200);
    expect(xlsxResponse.headers()["content-type"]).toContain("spreadsheetml");

    const pdfResponse = await page.request.get(pdfHref as string);
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  });

  test("an unauthenticated request never reaches report data — middleware redirects it to /login before the route handler's own 401 check would even run", async ({ request }) => {
    // The bare `request` fixture, not `page.request` — a fresh, cookie-less
    // context with no signed-in session, unlike every other test in this
    // file. `maxRedirects: 0` matters here: middleware.ts (Layer 2) redirects
    // every unauthenticated, non-public path — including a Route Handler,
    // since Next.js layouts don't wrap Route Handlers but middleware.ts's
    // matcher does — to /login before this request ever reaches
    // export/route.ts's own defense-in-depth 401 check (Layer 3). Without
    // `maxRedirects: 0`, this request would silently follow that redirect
    // and land on a 200 /login page, masking the real assertion: that the
    // request is intercepted at all, and that the interception happens
    // before any report data or file bytes are produced.
    const response = await request.get("http://127.0.0.1:3100/reports/export?report=members&period=yearly&year=2026&format=csv", {
      maxRedirects: 0,
    });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers()["location"]).toContain("/login");
  });

  test("the Vendor Report always masks financial fields, even though it composes the same query the Vendors page uses", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/reports?report=vendors&period=monthly&year=2026&month=3");
    await expect(page.getByRole("heading", { name: "Vendor Report" })).toBeVisible();
    await expect(page.getByText("Kilimanjaro Sound Ltd")).toBeVisible();
    // Neither financial field's own value nor a "not provided" placeholder
    // for it appears anywhere in the report table — the columns exist
    // (name/category/contact/status/date) but taxInformation/
    // bankPaymentInformation are simply never selected as columns, per
    // vendors.ts's own doc comment on why this report hard-codes
    // `includeFinancial: false` regardless of the caller's real permission.
    await expect(page.getByText("TIN-9988776")).toHaveCount(0);
    await expect(page.getByText("CRDB 0123456789")).toHaveCount(0);
  });

  test("a plain member does not see the Discipline Report in the picker and is refused if they force the URL or export", async ({ page }) => {
    await signIn(page, MEMBER_USER);
    await page.goto("/reports");
    await expect(page.getByRole("option", { name: "Discipline Report" })).toHaveCount(0);

    await page.goto("/reports?report=discipline&period=monthly&year=2026&month=3");
    await expect(page.getByText("You don't have permission to view disciplinary cases.")).toBeVisible();
    await expect(page.getByText("DISC-2026-9001")).toHaveCount(0);

    const exportResponse = await page.request.get("/reports/export?report=discipline&period=monthly&year=2026&month=3&format=csv");
    expect(exportResponse.status()).toBe(403);
  });

  test("a discipline.cases.read holder sees, runs, and exports the Discipline Report", async ({ page }) => {
    await signIn(page, DISCIPLINE_USER);
    await page.goto("/reports");
    // A closed native <select>'s <option> elements aren't considered
    // "visible" by Playwright's actionability check (no bounding box until
    // the dropdown is opened) — toHaveCount, not toBeVisible, is the right
    // assertion here, mirroring the negative case just above.
    await expect(page.getByRole("option", { name: "Discipline Report" })).toHaveCount(1);

    await page.goto("/reports?report=discipline&period=monthly&year=2026&month=3");
    await expect(page.getByRole("heading", { name: "Discipline Report" })).toBeVisible();
    await expect(page.getByText("DISC-2026-9001")).toBeVisible();

    const exportResponse = await page.request.get("/reports/export?report=discipline&period=monthly&year=2026&month=3&format=csv");
    expect(exportResponse.status()).toBe(200);
    expect(await exportResponse.text()).toContain("DISC-2026-9001");
  });
});
