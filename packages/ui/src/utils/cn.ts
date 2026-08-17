/**
 * Minimal classnames joiner. Deliberately not pulling in clsx/tailwind-merge
 * — this design system's components use a small, non-conflicting set of
 * Tailwind classes per element, so a full class-conflict resolver is an
 * unnecessary dependency (spec S64 "no unnecessary dependencies").
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}
