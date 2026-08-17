import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./export-csv";
import type { ReportResult } from "./types";

function result(rows: Record<string, string | number | null>[]): ReportResult {
  return {
    reportKey: "members",
    title: "Member Report",
    period: { from: "2026-01-01", to: "2026-01-31" },
    columns: [
      { key: "name", label: "Name" },
      { key: "count", label: "Count" },
    ],
    rows,
  };
}

test("toCsv renders a header row and one row per record, comma-joined", () => {
  const csv = toCsv(result([{ name: "Asha", count: 5 }]));
  assert.equal(csv, "Name,Count\r\nAsha,5\r\n");
});

test("toCsv quotes a field containing a comma", () => {
  const csv = toCsv(result([{ name: "Mwakalinga, Asha", count: 1 }]));
  assert.equal(csv, 'Name,Count\r\n"Mwakalinga, Asha",1\r\n');
});

test("toCsv quotes and doubles an embedded double-quote", () => {
  const csv = toCsv(result([{ name: 'The "Voice"', count: 1 }]));
  assert.equal(csv, 'Name,Count\r\n"The ""Voice""",1\r\n');
});

test("toCsv renders null as an empty field, not the literal string 'null'", () => {
  const csv = toCsv(result([{ name: "Asha", count: null }]));
  assert.equal(csv, "Name,Count\r\nAsha,\r\n");
});

test("toCsv handles zero rows, emitting only the header", () => {
  const csv = toCsv(result([]));
  assert.equal(csv, "Name,Count\r\n");
});

test("toCsv neutralizes a leading '=' so a spreadsheet app never evaluates it as a formula", () => {
  const csv = toCsv(result([{ name: "=HYPERLINK(\"http://evil.example\")", count: 1 }]));
  assert.equal(csv, 'Name,Count\r\n"\'=HYPERLINK(""http://evil.example"")",1\r\n');
});

test("toCsv neutralizes each of the other spreadsheet-formula trigger characters (+, -, @)", () => {
  for (const trigger of ["+", "-", "@"]) {
    const csv = toCsv(result([{ name: `${trigger}cmd`, count: 1 }]));
    assert.equal(csv, `Name,Count\r\n'${trigger}cmd,1\r\n`, `expected the leading '${trigger}' to be neutralized`);
  }
});

test("toCsv leaves a genuine negative number untouched — only string cells are formula-injection risk, not numeric ones", () => {
  const csv = toCsv(result([{ name: "Asha", count: -5 }]));
  assert.equal(csv, "Name,Count\r\nAsha,-5\r\n");
});

test("toCsv leaves an ordinary string starting with a letter or digit untouched", () => {
  const csv = toCsv(result([{ name: "Asha", count: 1 }]));
  assert.equal(csv, "Name,Count\r\nAsha,1\r\n");
});
