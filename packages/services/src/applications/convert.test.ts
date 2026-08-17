import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { convertApplicationToMember } from "./convert";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

const COMPLETE_DATA = {
  personal: { firstName: "Asha", lastName: "Mwakalinga", email: "asha@example.com", phone: "0700000000" },
  church: {},
  education: {},
  professional: {},
  choirHistory: {},
  musical: {},
};

function seedApproved(overrides: Partial<FakeRow> = {}) {
  let counter = 0;
  return createFakeSupabaseClient(
    {
      applications: [
        {
          id: "app-1",
          application_number: "APP-2026-0001",
          application_type: "new_member",
          access_token_hash: "hash",
          verification_contact: "asha@example.com",
          submitted_data: COMPLETE_DATA,
          status: "approved",
          completion_percentage: 100,
          missing_fields: [],
          reviewed_by: "user-hr",
          reviewed_at: "2026-01-05T00:00:00.000Z",
          decision_reason: "Meets all onboarding criteria.",
          submitted_at: "2026-01-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-05T00:00:00.000Z",
          ...overrides,
        },
      ],
      system_settings: [
        { setting_key: "id_format.member_number", value: "NGC-{year}-{sequence}" },
        { setting_key: "probation.default_duration_days", value: 90 },
      ],
    },
    {
      rpcStubs: {
        next_formatted_id: async (args) => {
          counter += 1;
          const format = String(args.p_format);
          return { data: format.replace("{year}", "2026").replace("{sequence}", String(counter).padStart(4, "0")), error: null };
        },
      },
    }
  );
}

test("convertApplicationToMember creates a member in probation, a probation record, and moves the application to 'probation'", async () => {
  const fake = seedApproved();
  const result = await convertApplicationToMember(asClient(fake), "app-1", { reviewerId: "user-hr" });

  assert.equal(result.member.firstName, "Asha");
  assert.equal(result.member.membershipStatus, "probation");
  assert.equal(result.application.status, "probation");

  const probationRows = fake.__db.get("probation") ?? [];
  assert.equal(probationRows.length, 1);
  assert.equal(probationRows[0]?.member_id, result.member.id);
  assert.equal(probationRows[0]?.duration_days, 90);
});

test("convertApplicationToMember records the initial department/family assignment through the history log, not a raw pointer set", async () => {
  const fake = seedApproved();
  const result = await convertApplicationToMember(asClient(fake), "app-1", {
    reviewerId: "user-hr",
    primaryDepartmentId: "dept-sopranos",
    familyId: "family-a",
  });

  assert.equal(result.member.primaryDepartmentId, "dept-sopranos");
  assert.equal(result.member.familyId, "family-a");

  const historyRows = fake.__db.get("member_departments") ?? [];
  assert.equal(historyRows.length, 1);
  assert.equal(historyRows[0]?.assignment_type, "primary");
  assert.equal(historyRows[0]?.changed_by, "user-hr");

  const familyHistoryRows = fake.__db.get("member_families") ?? [];
  assert.equal(familyHistoryRows.length, 1);
});

test("convertApplicationToMember refuses an application that isn't approved yet", async () => {
  const fake = seedApproved({ status: "pending_approval" });
  await assert.rejects(() => convertApplicationToMember(asClient(fake), "app-1", { reviewerId: "user-hr" }), ServiceError);
});

test("convertApplicationToMember refuses an information_update application", async () => {
  const fake = seedApproved({ application_type: "information_update" });
  await assert.rejects(() => convertApplicationToMember(asClient(fake), "app-1", { reviewerId: "user-hr" }), ServiceError);
});

test("convertApplicationToMember refuses when the applicant's name is missing", async () => {
  const fake = seedApproved({ submitted_data: { personal: {}, church: {}, education: {}, professional: {}, choirHistory: {}, musical: {} } });
  await assert.rejects(() => convertApplicationToMember(asClient(fake), "app-1", { reviewerId: "user-hr" }), ServiceError);
});
