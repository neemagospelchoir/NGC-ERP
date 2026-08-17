"use client";

import * as React from "react";
import { cn } from "../utils/cn";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, id, ...rest }, ref) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    return (
      <label htmlFor={fieldId} className="inline-flex items-center gap-2 text-sm text-ink-primary">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          className={cn(
            "h-4 w-4 rounded-sm border border-hairline text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500",
            className
          )}
          {...rest}
        />
        {label}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  name: string;
  legend: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}

/** Native radio inputs under a styled wrapper — never a div-only control, so
 * keyboard and screen-reader behavior come from the browser for free. */
export function RadioGroup({ name, legend, options, value, onChange, required }: RadioGroupProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink-primary">
        {legend}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-status-critical">
            *
          </span>
        )}
      </legend>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
          <label key={opt.value} className="inline-flex items-center gap-2 text-sm text-ink-primary">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange?.(opt.value)}
              required={required}
              className="h-4 w-4 border border-hairline text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
