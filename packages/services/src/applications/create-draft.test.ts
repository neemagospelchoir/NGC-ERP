import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createDraftApplication } from "./create-draft";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

function fakeWithSequence(tables: Record<string, FakeRow[]> = {}) {
  let counter = 0;
  return createFakeSupabaseClient(tables, {
    rpcStubs: {
      next_formatted_id: async (args) => {
        counter += 1;
        const format = String(args.p_format);
        return { data: format.replace("{year}", "2026").replace("{sequence}", String(counter).padStart(4, "0")), error: null };
      },
    },
  });
}

test("createDraftApplication reads the configured format, generates a number, and returns a raw token whose hash (not the raw value) is stored", async () => {
  const fake = fakeWithSequence({
    system_settings: [{ setting_key: "id_format.application_number", value: "APP-{year}-{sequence}" }],
  });

  const result = await createDraftApplication(asClient(fake), { verificationContact: "applicant@example.com" });

  assert.equal(result.applicationNumber, "APP-2026-0001");
  assert.ok(result.accessToken.length > 20);

  const stored = fake.__db.get("applications")?.[0];
  assert.ok(stored);
  assert.equal(stored?.status, "draft");
  assert.equal(stored?.verification_contact, "applicant@example.com");
  assert.notEqual(stored?.access_token_hash, result.accessToken);
  assert.equal(typeof stored?.access_token_hash, "string");
});

test("createDraftApplication falls back to a default format when system_settings has no row for it", async () => {
  const fake = fakeWithSequence({});
  const result = await createDraftApplication(asClient(fake), { verificationContact: "0700000000" });
  assert.equal(result.applicationNumber, "APP-2026-0001");
});

test("createDraftApplication rejects a blank verification contact", async () => {
  const fake = fakeWithSequence({});
  await assert.rejects(
    () => createDraftApplication(asClient(fake), { verificationContact: "   " }),
    ServiceError
  );
});

test("createDraftApplication starts every new draft with 0% completion and every required field listed as missing", async () => {
  const fake = fakeWithSequence({});
  await createDraftApplication(asClient(fake), { verificationContact: "applicant@example.com" });
  const stored = fake.__db.get("applications")?.[0];
  assert.equal(stored?.completion_percentage, 0);
  assert.ok(Array.isArray(stored?.missing_fields) && (stored?.missing_fields as string[]).length > 0);
});
