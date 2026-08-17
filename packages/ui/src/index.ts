// NGC ERP design system — public entry point. Import components from here
// (`@ngc/ui`), never reach into `src/components/*` directly, so the package
// surface stays a deliberate contract, not an accident of file layout.

export { Button } from "./components/Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./components/Button";

export { Input, Textarea, Select } from "./components/Input";
export type { InputProps, TextareaProps, SelectProps, SelectOption } from "./components/Input";

export { FormField } from "./components/FormField";
export type { FormFieldProps } from "./components/FormField";

export { Checkbox, RadioGroup } from "./components/Checkbox";
export type { CheckboxProps, RadioGroupProps, RadioOption } from "./components/Checkbox";

export { StatusPill, Badge } from "./components/StatusPill";
export type { StatusPillProps, StatusTone, BadgeProps } from "./components/StatusPill";

export { Card, CardHeader, CardTitle, CardFooter } from "./components/Card";
export type { CardProps } from "./components/Card";

export { Table } from "./components/Table";
export type { TableProps, TableColumn } from "./components/Table";

export { StatTile } from "./components/StatTile";
export type { StatTileProps } from "./components/StatTile";

export { EmptyState, ErrorState } from "./components/EmptyState";
export type { EmptyStateProps, ErrorStateProps } from "./components/EmptyState";

export { Modal } from "./components/Modal";
export type { ModalProps } from "./components/Modal";

export { ToastProvider, useToast } from "./components/Toast";
export type { ToastMessage, ToastVariant } from "./components/Toast";

export { Sidebar } from "./components/Sidebar";
export type { SidebarProps, NavGroupDef, NavItemDef } from "./components/Sidebar";

export { PageHeader } from "./components/PageHeader";
export type { PageHeaderProps } from "./components/PageHeader";

export { Avatar } from "./components/Avatar";
export type { AvatarProps } from "./components/Avatar";

export { cn } from "./utils/cn";
