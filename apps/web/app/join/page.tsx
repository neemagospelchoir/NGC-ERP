import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@ngc/ui";
import { StartForm } from "./start-form";

export const metadata: Metadata = { title: "Join Neema Gospel Choir" };

export default function JoinPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Apply to join Neema Gospel Choir</CardTitle>
        </CardHeader>
        <p className="mb-4 text-sm text-ink-secondary">
          Start your application below. You can save your progress and come back to finish it later — an application
          number and access code will be issued once you start.
        </p>
        <StartForm />
      </Card>
      <p className="text-center text-sm text-ink-secondary">
        Already started an application?{" "}
        <Link href="/join/continue" className="font-medium text-brand-700 hover:underline">
          Continue or check its status
        </Link>
      </p>
    </main>
  );
}
