import Link from "next/link";
import { Button, Card, CardHeader, CardTitle } from "@ngc/ui";

/**
 * Placeholder landing page. The real public site (marketing content, /join,
 * /invite, awards, media gallery) is a later phase — this page exists only
 * so Phase 5's design system has a real, building app to render inside, and
 * to link to the /style-guide acceptance page.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Neema Gospel Choir — ERP Platform</CardTitle>
        </CardHeader>
        <p className="text-sm text-ink-secondary">
          This app is under phased development. Phase 4 (Database), Phase 5
          (Design System), and Phase 6 (Authentication) are complete and
          validated. Public site content and the internal ERP modules follow
          in subsequent phases per the Development Control Rule.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/style-guide">
            <Button variant="secondary">View the design system</Button>
          </Link>
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
