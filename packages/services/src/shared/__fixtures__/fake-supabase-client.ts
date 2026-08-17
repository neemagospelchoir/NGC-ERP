/**
 * A minimal, hand-rolled fake of the slice of SupabaseClient the
 * departments/families/members/attendance/leave modules actually call:
 * `.from(table).select().eq()/.neq()/.is()/.in()/.ilike()/.or()/.gte()/
 * .lte()/.order()/.limit()/.maybeSingle()/.single()/.insert()/.update()/
 * .delete()`, plus `.rpc()`.
 *
 * This is a superset of auth/__fixtures__/fake-supabase-client.ts (which
 * predates this one and is left untouched — its tests already pass against
 * it). New modules under packages/services should use THIS fixture; it is
 * not a general Supabase mock, only what these modules' flat-query style
 * actually needs — a call to an unimplemented method throws immediately
 * rather than silently returning empty data, so a gap here is loud, not a
 * false pass.
 *
 * Phase 7.4 fix: `.order()` used to be a documented no-op (accepted for
 * chaining, never actually applied) — a real, silent gap this fixture's
 * own "a gap here is loud" promise didn't cover, since it returned wrong
 * data instead of throwing. It now actually sorts (nulls last, direction
 * from `ascending`), mirroring the real sort already implemented in
 * `apps/web/e2e/mock-gotrue-server.mjs`'s `queryTable()`.
 */

export type FakeRow = Record<string, unknown>;

interface QueryResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

type OrClause = { column: string; op: string; value: string };

function parseOrExpression(expr: string): OrClause[] {
  // Matches the exact subset this codebase emits, e.g.
  // "first_name.ilike.%asha%,last_name.ilike.%asha%"
  return expr.split(",").map((clause) => {
    const [column, op, ...rest] = clause.split(".");
    return { column: column ?? "", op: op ?? "", value: rest.join(".") };
  });
}

function ilikeMatches(value: unknown, pattern: string): boolean {
  const needle = pattern.replace(/^%/, "").replace(/%$/, "").toLowerCase();
  return String(value ?? "").toLowerCase().includes(needle);
}

class FakeQueryBuilder {
  private rows: FakeRow[];
  private readonly table: string;
  private readonly db: Map<string, FakeRow[]>;
  private readonly uniqueColumns: string[];
  private filters: Array<(row: FakeRow) => boolean> = [];
  private singleMode: "none" | "single" | "maybeSingle" = "none";
  private limitCount: number | null = null;
  private orderColumn: string | null = null;
  private orderAscending = true;
  private pendingInsert: FakeRow[] | null = null;
  private pendingUpdate: FakeRow | null = null;
  private pendingDelete = false;

  constructor(table: string, db: Map<string, FakeRow[]>, uniqueColumns: string[] = []) {
    this.table = table;
    this.db = db;
    this.rows = db.get(table) ?? [];
    this.uniqueColumns = uniqueColumns;
  }

  select(_columns?: string) {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => (value === null ? row[column] === null || row[column] === undefined : row[column] === value));
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  ilike(column: string, pattern: string) {
    this.filters.push((row) => ilikeMatches(row[column], pattern));
    return this;
  }

  // String comparison is sufficient (and simplest) for this codebase's
  // only current gte/lte use — ISO date strings (`YYYY-MM-DD`), which sort
  // lexicographically identically to chronologically.
  gte(column: string, value: unknown) {
    this.filters.push((row) => {
      const rowValue = row[column];
      return rowValue !== null && rowValue !== undefined && String(rowValue) >= String(value);
    });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push((row) => {
      const rowValue = row[column];
      return rowValue !== null && rowValue !== undefined && String(rowValue) <= String(value);
    });
    return this;
  }

  or(expression: string) {
    const clauses = parseOrExpression(expression);
    this.filters.push((row) =>
      clauses.some((clause) => {
        if (clause.op === "ilike") return ilikeMatches(row[clause.column], clause.value);
        if (clause.op === "eq") return String(row[clause.column]) === clause.value;
        return false;
      })
    );
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.orderAscending = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  insert(row: FakeRow | FakeRow[]) {
    this.pendingInsert = Array.isArray(row) ? row : [row];
    return this;
  }

  update(patch: FakeRow) {
    this.pendingUpdate = patch;
    return this;
  }

  delete() {
    this.pendingDelete = true;
    return this;
  }

  private execute<T>(): QueryResult<T> {
    if (this.pendingInsert) {
      const existing = this.db.get(this.table) ?? [];
      for (const newRow of this.pendingInsert) {
        for (const col of this.uniqueColumns) {
          if (existing.some((row) => row[col] === newRow[col])) {
            return {
              data: null,
              error: { message: `duplicate key value violates unique constraint`, code: "23505" },
            } as QueryResult<T>;
          }
        }
      }
      const inserted = this.pendingInsert.map((row, i) => ({
        id: `generated-${this.table}-${existing.length + i}`,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...row,
      }));
      this.db.set(this.table, [...existing, ...inserted]);

      if (this.singleMode === "single") {
        return inserted.length === 1
          ? { data: inserted[0] as unknown as T, error: null }
          : { data: null, error: { message: `Expected exactly one inserted row, got ${inserted.length}` } };
      }
      if (this.singleMode === "maybeSingle") {
        return { data: (inserted[0] ?? null) as unknown as T, error: null };
      }
      return { data: inserted as unknown as T, error: null };
    }

    let matched = this.rows.filter((row) => this.filters.every((f) => f(row)));

    if (this.pendingUpdate) {
      const all = this.db.get(this.table) ?? [];
      const matchedIds = new Set(matched.map((r) => r.id));
      const updated = all.map((row) =>
        matchedIds.has(row.id) ? { ...row, ...this.pendingUpdate, updated_at: "2026-01-02T00:00:00.000Z" } : row
      );
      this.db.set(this.table, updated);
      matched = updated.filter((row) => matchedIds.has(row.id));
    }

    if (this.pendingDelete) {
      const all = this.db.get(this.table) ?? [];
      const matchedIds = new Set(matched.map((r) => r.id));
      this.db.set(
        this.table,
        all.filter((row) => !matchedIds.has(row.id))
      );
    }

    let result = matched;
    if (this.orderColumn) {
      const column = this.orderColumn;
      const ascending = this.orderAscending;
      result = [...result].sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return ascending ? cmp : -cmp;
      });
    }
    if (this.limitCount != null) {
      result = result.slice(0, this.limitCount);
    }

    if (this.singleMode === "single") {
      if (result.length !== 1) {
        return { data: null, error: { message: `Expected exactly one row in "${this.table}", got ${result.length}` } };
      }
      return { data: result[0] as unknown as T, error: null };
    }
    if (this.singleMode === "maybeSingle") {
      return { data: (result[0] ?? null) as unknown as T, error: null };
    }
    return { data: result as unknown as T, error: null };
  }

  then<TResult1 = QueryResult<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export interface FakeRpcStubs {
  [functionName: string]: (args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface FakeSupabaseClientOptions {
  rpcStubs?: FakeRpcStubs;
  /** Column names to enforce as unique per table, e.g. `{ departments: ["name"] }` — simulates the Postgres 23505 error create.ts/update.ts map to a friendly message. */
  uniqueColumns?: Record<string, string[]>;
}

export function createFakeSupabaseClient(
  seedTables: Record<string, FakeRow[]> = {},
  options: FakeSupabaseClientOptions = {}
) {
  const db = new Map<string, FakeRow[]>(Object.entries(seedTables).map(([k, v]) => [k, [...v]]));
  const rpcStubs = options.rpcStubs ?? {};

  return {
    from(table: string) {
      return new FakeQueryBuilder(table, db, options.uniqueColumns?.[table] ?? []);
    },
    async rpc(functionName: string, args: Record<string, unknown> = {}) {
      const stub = rpcStubs[functionName];
      if (!stub) {
        throw new Error(`fake-supabase-client: rpc("${functionName}") was called but no stub was provided for this test.`);
      }
      return stub(args);
    },
    // Expose the in-memory store so tests can assert on inserts/updates.
    __db: db,
  };
}
