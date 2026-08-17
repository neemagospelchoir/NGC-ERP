import type { Metadata } from "next";
import { PageHeader } from "@ngc/ui";
import { StatusClient } from "./status-client";

export const metadata: Metadata = { title: "Check invitation status — NGC" };

export default function InviteStatusPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <PageHeader title="Check your invitation's status" breadcrumb={["Neema Gospel Choir"]} />
      <StatusClient />
    </main>
  );
}
