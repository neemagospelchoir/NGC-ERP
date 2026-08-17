import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createMember } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createMember reads the configured format and generates a Member ID via next_formatted_id", async () => {
  let seenArgs: Record<string, unknown> | undefined;
  const fake = createFakeSupabaseClient(
    {
      system_settings: [{ setting_key: "id_format.member_number", value: "NGC-{year}-{sequence}" }],
      members: [],
    },
    {
      rpcStubs: {
        next_formatted_id: async (args) => {
          seenArgs = args;
          return { data: "NGC-2026-0007", error: null };
        },
      },
    }
  );

  const created = await createMember(asClient(fake), { firstName: "Zawadi", lastName: "Komba" });

  assert.equal(created.memberNumber, "NGC-2026-0007");
  assert.deepEqual(seenArgs, { p_sequence_key: "member_number", p_format: "NGC-{year}-{sequence}" });
});

test("createMember falls back to a safe default format if system_settings is missing the row", async () => {
  let seenFormat: unknown;
  const fake = createFakeSupabaseClient(
    { system_settings: [], members: [] },
    {
      rpcStubs: {
        next_formatted_id: async (args) => {
          seenFormat = args.p_format;
          return { data: "MEMBER-2026-0001", error: null };
        },
      },
    }
  );

  const created = await createMember(asClient(fake), { firstName: "Zawadi", lastName: "Komba" });
  assert.equal(created.memberNumber, "MEMBER-2026-0001");
  assert.equal(seenFormat, "MEMBER-{year}-{sequence}");
});

test("createMember rejects blank names before touching the database", async () => {
  const fake = createFakeSupabaseClient({ system_settings: [], members: [] }, { rpcStubs: {} });
  await assert.rejects(() => createMember(asClient(fake), { firstName: "  ", lastName: "Komba" }), ServiceError);
});

test("createMember always starts a new member in probation (no membershipStatus accepted as input)", async () => {
  const fake = createFakeSupabaseClient(
    { system_settings: [], members: [] },
    { rpcStubs: { next_formatted_id: async () => ({ data: "MEMBER-2026-0001", error: null }) } }
  );

  const created = await createMember(asClient(fake), { firstName: "Zawadi", lastName: "Komba" });
  assert.equal(created.membershipStatus, "probation");
});
