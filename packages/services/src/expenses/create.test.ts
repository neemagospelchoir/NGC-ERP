import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createExpenseRequest } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createExpenseRequest reads the configured format and generates a request number via next_formatted_id", async () => {
  const fake = createFakeSupabaseClient(
    { system_settings: [{ setting_key: "id_format.expense_request_number", value: "EXP-{year}-{sequence}" }], expense_requests: [] },
    { rpcStubs: { next_formatted_id: async () => ({ data: "EXP-2026-0001", error: null }) } }
  );
  const request = await createExpenseRequest(asClient(fake), { description: "Transport for retreat", amount: 50000, requestedBy: "user-1" });
  assert.equal(request.requestNumber, "EXP-2026-0001");
  assert.equal(request.status, "draft");
  assert.equal(request.currency, "TZS");
});

test("createExpenseRequest falls back to a default format if system_settings is missing the row", async () => {
  const fake = createFakeSupabaseClient(
    { system_settings: [], expense_requests: [] },
    {
      rpcStubs: {
        next_formatted_id: async (args) => {
          assert.equal(args.p_format, "EXP-{year}-{sequence}");
          return { data: "EXP-2026-0002", error: null };
        },
      },
    }
  );
  await createExpenseRequest(asClient(fake), { description: "Catering", amount: 10000, requestedBy: "user-1" });
});

test("createExpenseRequest requires a description, a non-negative amount, and a requester", async () => {
  const fake = createFakeSupabaseClient({ system_settings: [] as FakeRow[], expense_requests: [] as FakeRow[] });
  await assert.rejects(() => createExpenseRequest(asClient(fake), { description: "  ", amount: 100, requestedBy: "user-1" }), ServiceError);
  await assert.rejects(() => createExpenseRequest(asClient(fake), { description: "Fuel", amount: -5, requestedBy: "user-1" }), ServiceError);
  await assert.rejects(() => createExpenseRequest(asClient(fake), { description: "Fuel", amount: 100, requestedBy: "" }), ServiceError);
});
