import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { reports } from "@ngc/services";

/**
 * PDF export renderer. Web-only (see docs/PHASE_13_1.md §2), and — per
 * ARCHITECTURE.md §15's "PDF export reuses the same rendering service as
 * letters/gate passes/itineraries" — deliberately written as a generic
 * "tabular report" document rather than something Reports-specific, so a
 * future phase adding PDF export to those other modules has a renderer to
 * reuse instead of a second, divergent @react-pdf/renderer setup. This
 * phase only wires it into Reports; see docs/PHASE_13_1.md §6 for what
 * stays deferred.
 *
 * @react-pdf/renderer (not a headless-Chromium screenshot) was chosen
 * specifically so this runs in a plain Node process with no browser binary
 * to ship — see docs/PHASE_13_1.md §2.
 *
 * Phase 16 (Next.js 14 -> 15 upgrade) root cause + fix, documented in full
 * because the symptom (a runtime-only "Minified React error #31: Objects
 * are not valid as a React child" on every PDF export, CSV/XLSX unaffected)
 * had no plausible-looking cause among the usual suspects:
 *
 *   - It was NOT a react/react-dom version mismatch: `pnpm why react` shows
 *     a single `react@18.3.1` throughout apps/web's dependency graph,
 *     confirmed at runtime by instrumenting @react-pdf/reconciler itself.
 *   - It was NOT `serverExternalPackages` (added, then proven to make no
 *     difference either way — the bug reproduces identically with or
 *     without externalizing @react-pdf/renderer).
 *   - It was NOT the specific JSX shapes in this file (style arrays, keyed
 *     `.map()` output) — a minimal one-line `<Document><Page><Text>` tree
 *     reproduced the identical error.
 *
 * The actual cause: every file under `app/` is compiled through Next's App
 * Router server-components toolchain, which resolves the bare `react`
 * import (and the automatic JSX runtime) to Next's OWN internally vendored
 * React build — not the plain `react@18.3.1` sitting in node_modules. That
 * internal build tags every element it creates with
 * `Symbol.for('react.transitional.element')`. @react-pdf/reconciler,
 * however, imports `react` the normal way (plain Node module resolution)
 * and gets the real node_modules `react@18.3.1`, whose own element-validity
 * check looks for the OLDER `Symbol.for('react.element')` tag. Confirmed by
 * direct instrumentation: `React.createElement` from a *normally-imported*
 * `react` inside this file produces a `react.transitional.element`-tagged
 * object even though `React.version` correctly reads `18.3.1` — proving the
 * version string and the element-tag scheme are coming from two genuinely
 * different React module instances that both happen to report the same
 * version. @react-pdf/reconciler's own `isValidElement`-style check then
 * rejects every element this file builds, which is exactly the "object with
 * keys {$$typeof, type, key, ref, props}" the minified error describes.
 *
 * The fix: build this one component tree using `React.createElement` from a
 * `require('react')` that Next's bundler cannot see or rewrite (a dynamic
 * `eval("require")`, immune to static import-rewriting/aliasing — the same
 * "force a genuinely native require" trick used to defeat bundler
 * aliasing/externals in general, e.g. by ORMs and native-binding loaders).
 * That gets the real node_modules React instance instead of Next's internal
 * one, producing elements @react-pdf/reconciler actually recognizes. JSX
 * syntax itself isn't the problem and could theoretically still be used if
 * this file's automatic-JSX-runtime import could itself be forced through
 * the same bypass; explicit `createElement` calls are simpler to guarantee
 * that with and avoid relying on JSX-pragma configuration per file.
 */
const nodeReact = eval("require")("react") as typeof import("react");
const h = nodeReact.createElement as (type: unknown, props: unknown, ...children: unknown[]) => unknown;

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 10, marginBottom: 16, color: "#555555" },
  table: { display: "flex", flexDirection: "column", borderWidth: 1, borderColor: "#dddddd" },
  headerRow: { flexDirection: "row", backgroundColor: "#f2f2f2", borderBottomWidth: 1, borderColor: "#dddddd" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#eeeeee" },
  cell: { padding: 4, flex: 1, fontSize: 8 },
  headerCell: { padding: 4, flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold" },
  cellRight: { textAlign: "right" as const },
});

function ReportDocument({ result }: { result: reports.ReportResult }) {
  const headerCells = result.columns.map((col) =>
    h(
      Text,
      { key: col.key, style: col.align === "right" ? [styles.headerCell, styles.cellRight] : styles.headerCell },
      col.label
    )
  );

  const bodyRows = result.rows.map((row, index) => {
    const cells = result.columns.map((col) => {
      const value = row[col.key] === null || row[col.key] === undefined ? "" : String(row[col.key]);
      return h(Text, { key: col.key, style: col.align === "right" ? [styles.cell, styles.cellRight] : styles.cell }, value);
    });
    // No stable id of its own in a generic tabular report — same tradeoff the
    // original JSX version documented via its own eslint-disable comment.
    return h(View, { key: index, style: styles.row }, ...cells);
  });

  return h(
    Document,
    null,
    h(
      Page,
      { size: "A4", orientation: "landscape", style: styles.page },
      h(Text, { style: styles.title }, result.title),
      h(
        Text,
        { style: styles.subtitle },
        `Period: ${result.period.from} to ${result.period.to} · ${result.rows.length} row${result.rows.length === 1 ? "" : "s"}`
      ),
      h(View, { style: styles.table }, h(View, { style: styles.headerRow }, ...headerCells), ...bodyRows)
    )
  );
}

export async function renderPdf(result: reports.ReportResult): Promise<Buffer> {
  const buffer = await renderToBuffer(h(ReportDocument, { result }) as never);
  return Buffer.from(buffer);
}
