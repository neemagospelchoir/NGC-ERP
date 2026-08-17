"use client";

import * as React from "react";
import { cn } from "../utils/cn";

export type ToastVariant = "success" | "warning" | "error" | "info";

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  push: (toast: Omit<ToastMessage, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-status-good/30 text-status-good",
  warning: "border-status-warning/40 text-[#8a5a00]",
  error: "border-status-critical/30 text-status-critical",
  info: "border-brand-300 text-brand-700",
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: "✓",
  warning: "▲",
  error: "✕",
  info: "ℹ",
};

/** Wrap the app (or the style-guide page) once with this provider; call
 * `useToast().push(...)` from anywhere to surface a confirmation/error. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (toast: Omit<ToastMessage, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "flex w-80 items-start gap-2 rounded-md border bg-surface-raised p-3 shadow-lg",
              VARIANT_CLASSES[toast.variant]
            )}
          >
            <span aria-hidden="true" className="mt-0.5">
              {VARIANT_ICON[toast.variant]}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-primary">{toast.title}</p>
              {toast.description && <p className="text-xs text-ink-secondary">{toast.description}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="text-ink-muted hover:text-ink-primary"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a <ToastProvider>");
  return ctx;
}
