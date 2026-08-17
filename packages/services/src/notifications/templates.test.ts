import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { createNotificationTemplate, listNotificationTemplates, updateNotificationTemplate } from "./templates";
import { ServiceError } from "../shared/errors";
import { createFakeSupabaseClient, type FakeRow } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("createNotificationTemplate creates a template defaulting to in_app/active", async () => {
  const fake = createFakeSupabaseClient({ notification_templates: [] });
  const template = await createNotificationTemplate(asClient(fake), {
    code: "rehearsal_reminder",
    name: "Rehearsal Reminder",
    bodyTemplate: "Reminder: rehearsal at {{time}}.",
  });
  assert.equal(template.code, "rehearsal_reminder");
  assert.deepEqual(template.defaultChannels, ["in_app"]);
  assert.equal(template.isActive, true);
});

test("createNotificationTemplate refuses a blank code", async () => {
  const fake = createFakeSupabaseClient({ notification_templates: [] });
  await assert.rejects(
    () => createNotificationTemplate(asClient(fake), { code: "  ", name: "Name", bodyTemplate: "Body" }),
    ServiceError
  );
});

test("listNotificationTemplates excludes inactive templates by default", async () => {
  const rows: FakeRow[] = [
    {
      id: "tmpl-1",
      code: "active_one",
      name: "Active",
      channel_subject: null,
      body_template: "Body",
      default_channels: ["in_app"],
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "tmpl-2",
      code: "inactive_one",
      name: "Inactive",
      channel_subject: null,
      body_template: "Body",
      default_channels: ["in_app"],
      is_active: false,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  const fake = createFakeSupabaseClient({ notification_templates: rows });
  const active = await listNotificationTemplates(asClient(fake));
  assert.equal(active.length, 1);
  const all = await listNotificationTemplates(asClient(fake), { includeInactive: true });
  assert.equal(all.length, 2);
});

test("updateNotificationTemplate updates the body template", async () => {
  const rows: FakeRow[] = [
    {
      id: "tmpl-1",
      code: "active_one",
      name: "Active",
      channel_subject: null,
      body_template: "Old body",
      default_channels: ["in_app"],
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  const fake = createFakeSupabaseClient({ notification_templates: rows });
  const updated = await updateNotificationTemplate(asClient(fake), "tmpl-1", {
    code: "active_one",
    name: "Active",
    bodyTemplate: "New body",
  });
  assert.equal(updated.bodyTemplate, "New body");
});
