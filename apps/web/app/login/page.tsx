import type { Metadata } from "next";
import { Card, CardHeader, CardTitle } from "@ngc/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — NGC ERP",
};

/**
 * Server Component shell (reads the `next` redirect target from the URL
 * middleware.ts attaches) around the Client Component form. Kept as a
 * Server Component so this page never ships more client JS than the form
 * itself needs.
 */
export default async function LoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Sign in to NGC ERP</CardTitle>
        </CardHeader>
        <LoginForm next={searchParams.next} />
      </Card>
    </main>
  );
}
