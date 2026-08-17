import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { getApplicationForApplicant, submitApplication, updateApplicationDraft } from "./applicant-access";
import { hashToken } from "./token";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const RAW_TOKEN = "test-raw-token-value";
const CONTACT = "applicant@example.com";

async function seedDraft(overrides: Partial<FakeRow> = {}) {
  const hash = await hashToken(RAW_TOKEN);
  const fake = createFakeSupabaseClient({
    applications: [
      {
        id: "app-1",
        application_number: "APP-2026-0001",
        application_type: "new_member",
        access_token_hash: hash,
        verification_contact: CONTACT,
        submitted_data: { personal: { firstName: "Asha" }, church: {}, education: {}, professional: {}, choirHistory: {}, musical: {} },
        status: "draft",
        completion_percentage: 10,
        missing_fields: ["Last name"],
        reviewed_by: null,
        reviewed_at: null,
        decision_reason: null,
        submitted_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...overrides,
      },
    ],
  });
  return fake;
}

test("getApplicationForApplicant succeeds with the correct token and verification contact", async () => {
  const fake = await seedDraft();
  const view = await getApplicationForApplicant(asClient(fake), {
    applicationNumber: "APP-2026-0001",
    accessToken: RAW_TOKEN,
    verificationContact: CONTACT,
  });
  assert.equal(view.status, "draft");
  assert.equal(view.formData.personal.firstName, "Asha");
});

test("getApplicationForApplicant rejects a wrong access token with a generic error", async () => {
  const fake = await seedDraft();
  await assert.rejects(
    () =>
      getApplicationForApplicant(asClient(fake), {
        applicationNumber: "APP-2026-0001",
        accessToken: "wrong-token",
        verificationContact: CONTACT,
      }),
    ServiceError
  );
});

test("getApplicationForApplicant rejects a mismatched verification contact even with the right token", async () => {
  const fake = await seedDraft();
  await assert.rejects(
    () =>
      getApplicationForApplicant(asClient(fake), {
        applicationNumber: "APP-2026-0001",
        accessToken: RAW_TOKEN,
        verificationContact: "someone-else@example.com",
      }),
    ServiceError
  );
});

test("getApplicationForApplicant rejects an unknown application number with the same generic error", async () => {
  const fake = await seedDraft();
  await assert.rejects(
    () =>
      getApplicationForApplicant(asClient(fake), {
        applicationNumber: "APP-2026-9999",
        accessToken: RAW_TOKEN,
        verificationContact: CONTACT,
      }),
    ServiceError
  );
});

test("updateApplicationDraft merges a partial patch into the existing section without clobbering other sections", async () => {
  const fake = await seedDraft();
  const view = await updateApplicationDraft(
    asClient(fake),
    { applicationNumber: "APP-2026-0001", accessToken: RAW_TOKEN, verificationContact: CONTACT },
    { personal: { lastName: "Mwakalinga" } }
  );
  assert.equal(view.formData.personal.firstName, "Asha");
  assert.equal(view.formData.personal.lastName, "Mwakalinga");
});

test("updateApplicationDraft recomputes completion percentage/missing fields", async () => {
  const fake = await seedDraft();
  const view = await updateApplicationDraft(
    asClient(fake),
    { applicationNumber: "APP-2026-0001", accessToken: RAW_TOKEN, verificationContact: CONTACT },
    { personal: { lastName: "Mwakalinga" } }
  );
  assert.ok(view.completionPercentage > 10);
});

test("updateApplicationDraft refuses to edit an already-submitted application", async () => {
  const fake = await seedDraft({ status: "pending_review" });
  await assert.rejects(
    () =>
      updateApplicationDraft(
        asClient(fake),
        { applicationNumber: "APP-2026-0001", accessToken: RAW_TOKEN, verificationContact: CONTACT },
        { personal: { lastName: "X" } }
      ),
    ServiceError
  );
});

const COMPLETE_DATA = {
  personal: {
    firstName: "Asha",
    lastName: "Mwakalinga",
    gender: "female",
    dateOfBirth: "1998-01-01",
    phone: "0700000000",
    email: "asha@example.com",
    physicalAddress: "123 Main St",
    emergencyContactName: "Baraka",
    emergencyContactPhone: "0711111111",
  },
  church: { currentChurch: "AICT" },
  education: {},
  professional: {},
  choirHistory: {},
  musical: {},
};

test("submitApplication rejects when required fields are still missing", async () => {
  const fake = await seedDraft();
  await assert.rejects(
    () =>
      submitApplication(asClient(fake), {
        applicationNumber: "APP-2026-0001",
        accessToken: RAW_TOKEN,
        verificationContact: CONTACT,
      }),
    ServiceError
  );
});

test("submitApplication succeeds once all required fields are present, setting status and submitted_at", async () => {
  const fake = await seedDraft({ submitted_data: COMPLETE_DATA, completion_percentage: 100, missing_fields: [] });
  const view = await submitApplication(asClient(fake), {
    applicationNumber: "APP-2026-0001",
    accessToken: RAW_TOKEN,
    verificationContact: CONTACT,
  });
  assert.equal(view.status, "submitted");
  assert.ok(view.submittedAt);
});

test("submitApplication also works from an incomplete status (resubmit after HR feedback)", async () => {
  const fake = await seedDraft({ status: "incomplete", submitted_data: COMPLETE_DATA });
  const view = await submitApplication(asClient(fake), {
    applicationNumber: "APP-2026-0001",
    accessToken: RAW_TOKEN,
    verificationContact: CONTACT,
  });
  assert.equal(view.status, "submitted");
});
