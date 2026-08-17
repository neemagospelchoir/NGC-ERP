import * as React from "react";

export interface PageHeaderProps {
  title: string;
  breadcrumb?: string[];
  action?: React.ReactNode;
}

/** Consistent header across every module screen (spec S67/S70 module list). */
export function PageHeader({ title, breadcrumb, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 border-b border-hairline pb-4">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <p className="mb-1 text-xs text-ink-muted">{breadcrumb.join(" / ")}</p>
        )}
        <h1 className="text-2xl font-bold text-ink-primary">{title}</h1>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
