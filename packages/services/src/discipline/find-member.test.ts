import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { findMemberByNumber } from "./find-member";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("findMemberByNumber returns the resolved member on an exact match", async () => {
  const fake = createFakeSupabaseClient({}, {
    rpcStubs: {
      find_member_by_number_for_discipline: async (args) => {
        assert.equal(args.p_member_number, "NGC-2026-0099");
        return {
          data: [{ id: "member-99", first_name: "Juma", last_name: "Kessy", member_number: "NGC-2026-0099", membership_status: "active" }],
          error: null,
        };
      },
    },
  });

  const result = await findMemberByNumber(asClient(fake), "NGC-2026-0099");
  assert.equal(result.id, "member-99");
  assert.equal(result.firstName, "Juma");
});

test("findMemberByNumber throws a generic not-found error when the RPC returns no rows (unknown number OR unauthorized caller)", async () => {
  const fake = createFakeSupabaseClient({}, {
    rpcStubs: { find_member_by_number_for_discipline: async () => ({ data: [], error: null }) },
  });

  await assert.rejects(() => findMemberByNumber(asClient(fake), "NGC-2026-9999"), /No member found/);
});

test("findMemberByNumber rejects a blank number without calling the RPC", async () => {
  const fake = createFakeSupabaseClient({}, { rpcStubs: {} });
  await assert.rejects(() => findMemberByNumber(asClient(fake), "   "));
});
