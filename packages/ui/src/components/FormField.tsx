import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Shared label/hint/error chrome used by Input, Textarea, and Select so
 * every form control in the ERP has the same accessible label association
 * and the same error presentation (icon + text, not color alone — S52/S67).
 */
export interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ id, label, hint, error, required, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-primary">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-status-critical">
            *
          </span>
        )}
      </label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            id,
            "aria-describedby": cn(hintId, errorId) || undefined,
            "aria-invalid": Boolean(error) || undefined,
          })
        : children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1 text-xs text-status-critical">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}
