import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createGatePass } from "./create";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createGatePass reads the configured format and generates a gate pass number via next_formatted_id", async () => {
  const fake = createFakeSupabaseClient(
    { system_settings: [{ setting_key: "id_format.gate_pass_number", value: "GP-{year}-{sequence}" }], gate_passes: [] },
    { rpcStubs: { next_formatted_id: async () => ({ data: "GP-2026-0001", error: null }) } }
  );
  const gatePass = await createGatePass(asClient(fake), { eventId: "event-1", personResponsibleId: "user-1" });
  assert.equal(gatePass.gatePassNumber, "GP-2026-0001");
  assert.equal(gatePass.status, "pending_approval");
});

test("createGatePass falls back to a default format if system_settings is missing the row", async () => {
  const fake = createFakeSupabaseClient(
    { system_settings: [], gate_passes: [] },
    {
      rpcStubs: {
        next_formatted_id: async (args) => {
          assert.equal(args.p_format, "GP-{year}-{sequence}");
          return { data: "GP-2026-0002", error: null };
        },
      },
    }
  );
  await createGatePass(asClient(fake), { eventId: "event-1", personResponsibleId: "user-1" });
});

test("createGatePass requires an event and a responsible person", async () => {
  const fake = createFakeSupabaseClient({ system_settings: [] as FakeRow[], gate_passes: [] });
  await assert.rejects(() => createGatePass(asClient(fake), { eventId: "", personResponsibleId: "user-1" }), ServiceError);
  await assert.rejects(() => createGatePass(asClient(fake), { eventId: "event-1", personResponsibleId: "" }), ServiceError);
});
