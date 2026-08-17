import * as React from "react";
import { cn } from "../utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  isLoading?: boolean;
}

export function Card({ interactive, isLoading, className, children, ...rest }: CardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-md border border-hairline bg-surface p-4 shadow-sm",
          className
        )}
        aria-hidden="true"
      >
        <div className="mb-3 h-4 w-1/3 rounded-sm bg-ink-muted/20" />
        <div className="h-3 w-full rounded-sm bg-ink-muted/10" />
        <div className="mt-2 h-3 w-2/3 rounded-sm bg-ink-muted/10" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-md border border-hairline bg-surface p-4 shadow-sm",
        interactive && "transition-shadow hover:shadow-md",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-semibold text-ink-primary", className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardFooter({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-4 flex items-center justify-end gap-2 border-t border-hairline pt-3", className)} {...rest}>
      {children}
    </div>
  );
}
