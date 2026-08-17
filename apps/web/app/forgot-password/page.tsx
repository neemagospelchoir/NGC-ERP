import type { Metadata } from "next";
import { Card, CardHeader, CardTitle } from "@ngc/ui";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password — NGC ERP",
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <p className="mb-4 text-sm text-ink-secondary">
          Enter the email address on your account and we&apos;ll send you a link to reset your password.
        </p>
        <ForgotPasswordForm />
      </Card>
    </main>
  );
}
