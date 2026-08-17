import type { Metadata } from "next";
import { Card, CardHeader, CardTitle } from "@ngc/ui";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account — NGC ERP",
};

/**
 * Self-service registration for ordinary choir members. Every account this
 * form creates lands with the `choir_member` role only — see
 * supabase/migrations/0041_username_and_self_signup.sql's auth.users
 * trigger. An admin upgrades anyone who needs a staff role afterward.
 *
 * Kept as a Server Component shell around the Client Component form, same
 * pattern as /login, so this page ships no more client JS than the form
 * itself needs.
 */
export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create your NGC ERP account</CardTitle>
        </CardHeader>
        <SignUpForm />
      </Card>
    </main>
  );
}
