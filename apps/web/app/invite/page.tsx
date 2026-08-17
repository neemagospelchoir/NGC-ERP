import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@ngc/ui";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Invite Neema Gospel Choir" };

export default function InvitePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite Neema Gospel Choir</CardTitle>
        </CardHeader>
        <p className="mb-4 text-sm text-ink-secondary">
          Submit an invitation for your event below. Our team reviews every submission — nothing is confirmed until
          you hear back through our approval process.
        </p>
        <InviteForm />
      </Card>
      <p className="text-center text-sm text-ink-secondary">
        Already submitted an invitation?{" "}
        <Link href="/invite/status" className="font-medium text-brand-700 hover:underline">
          Check its status
        </Link>
      </p>
    </main>
  );
}
