"use client";

import * as React from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  RadioGroup,
  Select,
  Sidebar,
  StatTile,
  StatusPill,
  Table,
  Textarea,
  useToast,
} from "@ngc/ui";
import type { NavGroupDef, TableColumn } from "@ngc/ui";

interface DemoMember {
  id: string;
  name: string;
  department: string;
  membershipStatus: "active" | "probation" | "suspended";
  attendancePct: number;
  disciplineFlag: boolean;
}

const DEMO_MEMBERS: DemoMember[] = [
  { id: "1", name: "DEMO Grace Mwangaza", department: "Sopranos", membershipStatus: "active", attendancePct: 92, disciplineFlag: false },
  { id: "2", name: "DEMO Peter Kileo", department: "Tenors", membershipStatus: "probation", attendancePct: 68, disciplineFlag: false },
  { id: "3", name: "DEMO Asha Ramadhani", department: "Altos", membershipStatus: "suspended", attendancePct: 41, disciplineFlag: true },
];

const NAV_GROUPS: NavGroupDef[] = [
  {
    key: "core",
    label: "Core",
    items: [
      { key: "dashboard", label: "Dashboard", href: "#" },
      { key: "members", label: "Members", href: "#" },
      { key: "attendance", label: "Attendance", href: "#" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      { key: "technical", label: "Technical", href: "#" },
      { key: "inventory", label: "Inventory", href: "#" },
      { key: "finance", label: "Finance", href: "#" },
    ],
  },
];

function membershipStatusPill(status: DemoMember["membershipStatus"]) {
  switch (status) {
    case "active":
      return <StatusPill tone="good" label="Active" />;
    case "probation":
      return <StatusPill tone="warning" label="Probation" />;
    case "suspended":
      return <StatusPill tone="critical" label="Suspended" />;
  }
}

const MEMBER_COLUMNS: TableColumn<DemoMember>[] = [
  {
    key: "name",
    header: "Member",
    render: (row) => (
      <div className="flex items-center gap-2">
        <Avatar name={row.name} size="sm" />
        <span>{row.name}</span>
      </div>
    ),
  },
  { key: "department", header: "Department", render: (row) => row.department },
  { key: "status", header: "Status", render: (row) => membershipStatusPill(row.membershipStatus) },
  {
    key: "attendance",
    header: "Attendance",
    numeric: true,
    render: (row) => `${row.attendancePct}%`,
  },
  {
    key: "discipline",
    header: "Discipline",
    render: (row) =>
      row.disciplineFlag ? (
        <StatusPill tone="serious" label="Open case (restricted)" />
      ) : (
        <span className="text-ink-muted">—</span>
      ),
  },
];

export default function StyleGuidePage() {
  const toast = useToast();
  const [isModalOpen, setModalOpen] = React.useState(false);
  const [isTableLoading, setTableLoading] = React.useState(false);
  const [showEmptyExample, setShowEmptyExample] = React.useState(false);
  const [radioValue, setRadioValue] = React.useState("yes");

  return (
    <div className="flex min-h-screen">
      <Sidebar groups={NAV_GROUPS} activeHref="#" />

      <div className="flex-1 bg-surface-plane p-8">
        <PageHeader
          title="Design System — Style Guide"
          breadcrumb={["Administration", "Design System"]}
          action={
            <Button
              variant="secondary"
              onClick={() =>
                toast.push({
                  variant: "info",
                  title: "This is a toast",
                  description: "Auto-dismisses in 5 seconds, or click the ✕.",
                })
              }
            >
              Trigger a toast
            </Button>
          }
        />

        <div className="grid grid-cols-1 gap-8">
          {/* --- KPI row --- */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink-primary">KPI tiles</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatTile label="Active Members" value={148} delta={{ value: "+4 this month", direction: "up", sentiment: "good" }} />
              <StatTile
                label="Attendance (30d avg)"
                value="86%"
                delta={{ value: "-2pts vs last month", direction: "down", sentiment: "good" }}
                helperText="Eligibility threshold: 70%"
              />
              <StatTile label="Outstanding Contributions" value="TZS 1.2M" delta={{ value: "+150K", direction: "up", sentiment: "bad" }} />
              <StatTile label="Pending Approvals" value={12} isLoading />
            </div>
          </section>

          {/* --- Buttons --- */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink-primary">Buttons</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button isLoading>Saving</Button>
              <Button disabled>Disabled</Button>
            </div>
          </section>

          {/* --- Status pills / badges --- */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink-primary">Status &amp; badges</h2>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="good" label="Approved" />
              <StatusPill tone="warning" label="Pending Review" />
              <StatusPill tone="serious" label="Attention Needed" />
              <StatusPill tone="critical" label="Rejected" />
              <StatusPill tone="neutral" label="Draft" />
              <Badge variant="brand">Member</Badge>
              <Badge variant="accent">Award Winner</Badge>
            </div>
          </section>

          {/* --- Form controls --- */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink-primary">Form controls</h2>
            <Card className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Full name" placeholder="e.g. Grace Mwangaza" required hint="As it should appear on the Member ID." />
              <Input label="Email" type="email" defaultValue="not-an-email" error="Enter a valid email address." />
              <Select
                label="Department"
                placeholder="Select a department"
                options={[
                  { value: "sopranos", label: "Sopranos" },
                  { value: "altos", label: "Altos" },
                  { value: "tenors", label: "Tenors" },
                ]}
              />
              <Textarea label="Notes" placeholder="Optional internal notes" hint="Visible to HR only." />
              <Checkbox label="I confirm this information is accurate." />
              <RadioGroup
                name="voting-demo"
                legend="Vote"
                value={radioValue}
                onChange={setRadioValue}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "abstain", label: "Abstain" },
                ]}
              />
            </Card>
          </section>

          {/* --- Table with loading/empty states --- */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink-primary">Table (loading / empty / populated)</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setTableLoading((v) => !v)}>
                  Toggle loading
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowEmptyExample((v) => !v)}>
                  Toggle empty state
                </Button>
              </div>
            </div>
            <Table
              columns={MEMBER_COLUMNS}
              rows={showEmptyExample ? [] : DEMO_MEMBERS}
              rowKey={(row) => row.id}
              isLoading={isTableLoading}
              emptyTitle="No members match this filter"
              emptyDescription="Try clearing the department or status filter."
            />
          </section>

          {/* --- Empty / error states --- */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-ink-primary">Empty state</h2>
              <EmptyState
                title="No invitations yet"
                description="Approved invitations will appear here once submitted via the public link."
                action={<Button size="sm">Share invitation link</Button>}
              />
            </div>
            <div>
              <h2 className="mb-3 text-lg font-semibold text-ink-primary">Error state</h2>
              <ErrorState action={<Button size="sm" variant="secondary">Retry</Button>} />
            </div>
          </section>

          {/* --- Modal --- */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink-primary">Modal</h2>
            <Button onClick={() => setModalOpen(true)}>Open approval confirmation</Button>
            <Modal
              isOpen={isModalOpen}
              onClose={() => setModalOpen(false)}
              title="Approve this expense request?"
              description="TZS 250,000 — Transport — DEMO_Sunday Worship Concert"
              footer={
                <>
                  <Button variant="secondary" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setModalOpen(false);
                      toast.push({ variant: "success", title: "Expense approved" });
                    }}
                  >
                    Approve
                  </Button>
                </>
              }
            />
          </section>
        </div>
      </div>
    </div>
  );
}
