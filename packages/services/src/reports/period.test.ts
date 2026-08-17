import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePeriodRange } from "./period";

test("monthly resolves to the first and last calendar day of that month", () => {
  assert.deepEqual(resolvePeriodRange({ period: "monthly", year: 2026, month: 2 }), { from: "2026-02-01", to: "2026-02-28" });
});

test("monthly correctly handles a leap-year February", () => {
  assert.deepEqual(resolvePeriodRange({ period: "monthly", year: 2028, month: 2 }), { from: "2028-02-01", to: "2028-02-29" });
});

test("monthly rejects an out-of-range month", () => {
  assert.throws(() => resolvePeriodRange({ period: "monthly", year: 2026, month: 13 }));
  assert.throws(() => resolvePeriodRange({ period: "monthly", year: 2026, month: 0 }));
});

test("quarterly resolves Q1 to Jan 1 - Mar 31", () => {
  assert.deepEqual(resolvePeriodRange({ period: "quarterly", year: 2026, quarter: 1 }), { from: "2026-01-01", to: "2026-03-31" });
});

test("quarterly resolves Q4 to Oct 1 - Dec 31", () => {
  assert.deepEqual(resolvePeriodRange({ period: "quarterly", year: 2026, quarter: 4 }), { from: "2026-10-01", to: "2026-12-31" });
});

test("quarterly rejects an out-of-range quarter", () => {
  assert.throws(() => resolvePeriodRange({ period: "quarterly", year: 2026, quarter: 5 }));
});

test("yearly resolves to Jan 1 - Dec 31 of that year", () => {
  assert.deepEqual(resolvePeriodRange({ period: "yearly", year: 2026 }), { from: "2026-01-01", to: "2026-12-31" });
});

test("custom passes the given range through unchanged", () => {
  assert.deepEqual(resolvePeriodRange({ period: "custom", from: "2026-03-05", to: "2026-03-19" }), { from: "2026-03-05", to: "2026-03-19" });
});

test("custom rejects a to-date before the from-date", () => {
  assert.throws(() => resolvePeriodRange({ period: "custom", from: "2026-03-19", to: "2026-03-05" }));
});

test("custom rejects a missing bound", () => {
  assert.throws(() => resolvePeriodRange({ period: "custom", from: "", to: "2026-03-05" }));
});
