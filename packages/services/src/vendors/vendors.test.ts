import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listVendors, getVendor, listVendorCategories } from "./list";
import { createVendor } from "./create";
import { updateVendor, setVendorStatus } from "./update";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const CATEGORIES: FakeRow[] = [{ id: "cat-transport", name: "Transport", created_at: "2026-01-01T00:00:00.000Z" }];

const VENDORS: FakeRow[] = [
  {
    id: "vendor-1",
    name: "Kilimanjaro Coaches",
    category_id: "cat-transport",
    contact_person: "Juma",
    phone: "0700000000",
    email: null,
    address: null,
    tax_information: "TIN-12345",
    bank_payment_information: "NBC 001-002-003",
    performance_notes: null,
    status: "active",
  },
];

test("listVendors masks tax/bank fields by default and reports financialFieldsVisible=false", async () => {
  const fake = createFakeSupabaseClient({ vendors: VENDORS, vendor_categories: CATEGORIES });
  const [vendor] = await listVendors(asClient(fake));
  assert.equal(vendor.taxInformation, null);
  assert.equal(vendor.bankPaymentInformation, null);
  assert.equal(vendor.financialFieldsVisible, false);
  assert.equal(vendor.contactPerson, "Juma"); // non-financial fields are never masked
});

test("listVendors includes tax/bank fields when includeFinancial is explicitly set", async () => {
  const fake = createFakeSupabaseClient({ vendors: VENDORS, vendor_categories: CATEGORIES });
  const [vendor] = await listVendors(asClient(fake), { includeFinancial: true });
  assert.equal(vendor.taxInformation, "TIN-12345");
  assert.equal(vendor.bankPaymentInformation, "NBC 001-002-003");
  assert.equal(vendor.financialFieldsVisible, true);
});

test("getVendor masks financial fields by default and returns null for an unknown id", async () => {
  const fake = createFakeSupabaseClient({ vendors: VENDORS });
  const found = await getVendor(asClient(fake), "vendor-1");
  assert.equal(found?.taxInformation, null);
  const missing = await getVendor(asClient(fake), "does-not-exist");
  assert.equal(missing, null);
});

test("listVendorCategories returns categories sorted by name", async () => {
  const fake = createFakeSupabaseClient({ vendor_categories: CATEGORIES });
  const result = await listVendorCategories(asClient(fake));
  assert.deepEqual(result.map((c) => c.name), ["Transport"]);
});

test("createVendor requires a name and a category, and echoes financial fields back to the creator", async () => {
  const fake = createFakeSupabaseClient({ vendors: [] });
  await assert.rejects(() => createVendor(asClient(fake), { name: "  ", categoryId: "cat-transport" }), ServiceError);
  await assert.rejects(() => createVendor(asClient(fake), { name: "New Vendor", categoryId: "" }), ServiceError);

  const created = await createVendor(asClient(fake), {
    name: "New Vendor",
    categoryId: "cat-transport",
    taxInformation: "TIN-999",
  });
  assert.equal(created.name, "New Vendor");
  assert.equal(created.taxInformation, "TIN-999");
  assert.equal(created.financialFieldsVisible, true);
});

test("updateVendor applies a partial patch and rejects an empty name", async () => {
  const fake = createFakeSupabaseClient({ vendors: VENDORS });
  const updated = await updateVendor(asClient(fake), "vendor-1", { phone: "0711111111" });
  assert.equal(updated.phone, "0711111111");
  assert.equal(updated.name, "Kilimanjaro Coaches");

  await assert.rejects(() => updateVendor(asClient(fake), "vendor-1", { name: "   " }), ServiceError);
});

test("updateVendor masks financial fields in the response when the patch didn't touch them, even though the row still has real values", async () => {
  const fake = createFakeSupabaseClient({ vendors: VENDORS });
  const updated = await updateVendor(asClient(fake), "vendor-1", { phone: "0711111111" });
  assert.equal(updated.taxInformation, null);
  assert.equal(updated.bankPaymentInformation, null);
  assert.equal(updated.financialFieldsVisible, false);
});

test("updateVendor includes financial fields in the response only when this call actually patched one", async () => {
  const fake = createFakeSupabaseClient({ vendors: VENDORS });
  const updated = await updateVendor(asClient(fake), "vendor-1", { taxInformation: "TIN-NEW" });
  assert.equal(updated.taxInformation, "TIN-NEW");
  assert.equal(updated.financialFieldsVisible, true);
});

test("setVendorStatus updates status only and never echoes financial fields", async () => {
  const fake = createFakeSupabaseClient({ vendors: VENDORS });
  const updated = await setVendorStatus(asClient(fake), "vendor-1", "blacklisted");
  assert.equal(updated.status, "blacklisted");
  assert.equal(updated.taxInformation, null);
  assert.equal(updated.financialFieldsVisible, false);
});

test("listVendors filters by a created_at range — added for Phase 13.2's Vendor Report", async () => {
  const fake = createFakeSupabaseClient({
    vendors: [
      { ...VENDORS[0], id: "vendor-in-period", created_at: "2026-02-05T00:00:00.000Z" },
      { ...VENDORS[0], id: "vendor-outside-period", created_at: "2026-05-01T00:00:00.000Z" },
    ],
    vendor_categories: CATEGORIES,
  });
  const result = await listVendors(asClient(fake), { createdFrom: "2026-02-01", createdTo: "2026-02-28" });
  assert.deepEqual(result.map((v) => v.id), ["vendor-in-period"]);
});
