import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { runVendorsReport } from "./vendors";
import { createFakeSupabaseClient, type FakeRow } from "../../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const CATEGORIES: FakeRow[] = [{ id: "cat-transport", name: "Transport" }];
const VENDORS: FakeRow[] = [
  { id: "vendor-1", name: "Kilimanjaro Coaches", category_id: "cat-transport", contact_person: "Juma", status: "active", tax_information: "TIN-1", bank_payment_information: "NBC-1", created_at: "2026-02-05T00:00:00.000Z" },
  { id: "vendor-2", name: "Outside Period Ltd", category_id: "cat-transport", contact_person: null, status: "active", tax_information: null, bank_payment_information: null, created_at: "2026-05-01T00:00:00.000Z" },
];

test("runVendorsReport scopes by the resolved period, resolves category names, and never surfaces financial fields", async () => {
  const fake = createFakeSupabaseClient({ vendors: VENDORS, vendor_categories: CATEGORIES });
  const result = await runVendorsReport(asClient(fake), { period: { period: "monthly", year: 2026, month: 2 } });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.name, "Kilimanjaro Coaches");
  assert.equal(result.rows[0]?.category, "Transport");
  assert.equal("taxInformation" in result.rows[0]!, false, "the Vendor Report must never surface tax/bank fields, regardless of caller permission");
});
