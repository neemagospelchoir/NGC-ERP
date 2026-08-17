import type { Metadata } from "next";
import { Card, CardHeader, CardTitle, ErrorState } from "@ngc/ui";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset password — NGC ERP",
};

/**
 * Server Component gate: a session only exists here if /auth/callback's
 * code exchange succeeded moments ago. Anyone landing on this URL without
 * that (an expired/reused link, or a direct hit) sees an explicit error
 * instead of a form that would fail confusingly on submit.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        {user ? (
          <ResetPasswordForm />
        ) : (
          <ErrorState
            title="This link has expired"
            description="Password reset links can only be used once and expire after a short time. Request a new one from the forgot-password page."
          />
        )}
      </Card>
    </main>
  );
}
