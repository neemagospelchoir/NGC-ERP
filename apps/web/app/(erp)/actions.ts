"use server";

import { redirect } from "next/navigation";
import { auth } from "@ngc/services";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await auth.signOut(supabase);
  redirect("/login");
}
