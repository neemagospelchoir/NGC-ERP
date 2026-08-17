import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ngc/db";
import { listDisciplineCategories } from "./categories";
import { createFakeSupabaseClient } from "../shared/__fixtures__/fake-supabase-client";

function asClient(fake: ReturnType<typeof createFakeSupabaseClient>): SupabaseClient<Database> {
  return fake as unknown as SupabaseClient<Database>;
}

test("listDisciplineCategories returns only active categories, sorted", async () => {
  const fake = createFakeSupabaseClient({
    lookup_values: [
      { id: "lv-2", category: "discipline_category", code: "financial", label: "Financial", sort_order: 3, is_active: true },
      { id: "lv-1", category: "discipline_category", code: "conduct", label: "Conduct", sort_order: 1, is_active: true },
      { id: "lv-3", category: "discipline_category", code: "retired", label: "Retired", sort_order: 2, is_active: false },
    ],
  });

  const categories = await listDisciplineCategories(asClient(fake));
  assert.deepEqual(categories.map((c) => c.code), ["conduct", "financial"]);
});
