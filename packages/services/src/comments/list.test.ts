import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listComments, addComment } from "./list";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("addComment defaults to internal-only and listComments returns it in chronological order", async () => {
  const fake = createFakeSupabaseClient({ comments: [] });
  await addComment(asClient(fake), { ownerType: "invitation", ownerId: "inv-1", authorId: "user-1", body: "First note." });
  await addComment(asClient(fake), {
    ownerType: "invitation",
    ownerId: "inv-1",
    authorId: "user-1",
    body: "Visible to organizer.",
    isInternal: false,
  });

  const all = await listComments(asClient(fake), "invitation", "inv-1");
  assert.equal(all.length, 2);
  assert.equal(all[0]?.isInternal, true);
  assert.equal(all[1]?.isInternal, false);
});

test("addComment rejects a blank body", async () => {
  const fake = createFakeSupabaseClient({ comments: [] });
  await assert.rejects(() => addComment(asClient(fake), { ownerType: "invitation", ownerId: "inv-1", authorId: "user-1", body: "   " }));
});

test("listComments scopes strictly to the given owner", async () => {
  const fake = createFakeSupabaseClient({ comments: [] });
  await addComment(asClient(fake), { ownerType: "invitation", ownerId: "inv-1", authorId: "user-1", body: "On inv-1." });
  await addComment(asClient(fake), { ownerType: "invitation", ownerId: "inv-2", authorId: "user-1", body: "On inv-2." });

  const rows = await listComments(asClient(fake), "invitation", "inv-1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.body, "On inv-1.");
});
