import * as React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Used platform-wide instead of a bare "no data" string (spec S67). The same
 * component serves both "no records exist yet" and "no results match your
 * filter" — callers differentiate via title/description copy, not a second
 * component. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-hairline bg-surface px-6 py-10 text-center">
      {icon && (
        <div aria-hidden="true" className="mb-1 text-3xl text-ink-muted">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-ink-primary">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-secondary">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * For a failed section/page load. Deliberately takes only a safe, generic
 * description — never a raw error/stack trace prop — pairing with the API
 * layer's error-normalization rule (spec S52/S67: never expose backend
 * internals to the client).
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Please try again, or contact support if the problem continues.",
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-status-critical/30 bg-status-critical/5 px-6 py-10 text-center">
      <div aria-hidden="true" className="mb-1 text-3xl text-status-critical">
        ⚠
      </div>
      <p className="text-sm font-medium text-ink-primary">{title}</p>
      <p className="max-w-sm text-sm text-ink-secondary">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
