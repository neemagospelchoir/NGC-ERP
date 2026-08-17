"use client";

import * as React from "react";
import { cn } from "../utils/cn";
import { FormField } from "./FormField";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

const baseFieldClasses =
  "h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-sm text-ink-primary " +
  "placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-brand-500 disabled:bg-surface-plane disabled:text-ink-muted";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required, className, id, ...rest }, ref) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    return (
      <FormField id={fieldId} label={label} hint={hint} error={error} required={required}>
        <input
          ref={ref}
          required={required}
          className={cn(baseFieldClasses, error && "border-status-critical", className)}
          {...rest}
        />
      </FormField>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, required, className, id, rows = 4, ...rest }, ref) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    return (
      <FormField id={fieldId} label={label} hint={hint} error={error} required={required}>
        <textarea
          ref={ref}
          rows={rows}
          required={required}
          className={cn(
            "w-full resize-y rounded-sm border border-hairline bg-surface px-3 py-2 text-sm text-ink-primary",
            "placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
            error && "border-status-critical",
            className
          )}
          {...rest}
        />
      </FormField>
    );
  }
);
Textarea.displayName = "Textarea";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, required, className, id, options, placeholder, ...rest }, ref) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    return (
      <FormField id={fieldId} label={label} hint={hint} error={error} required={required}>
        <select
          ref={ref}
          required={required}
          className={cn(baseFieldClasses, "appearance-none", error && "border-status-critical", className)}
          defaultValue={rest.defaultValue ?? ""}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>
    );
  }
);
Select.displayName = "Select";
