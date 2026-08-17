import type { Metadata } from "next";
import { PageHeader } from "@ngc/ui";
import { ContinueClient } from "./continue-client";

export const metadata: Metadata = { title: "Continue your application — NGC" };

export default function JoinContinuePage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <PageHeader title="Continue your application" breadcrumb={["Neema Gospel Choir"]} />
      <ContinueClient />
    </main>
  );
}
