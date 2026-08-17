/**
 * A minimal, hand-rolled fake of the slice of SupabaseClient this package's
 * auth module actually calls: `.auth.*` (stubbed per-test with plain
 * functions) and `.from(table).select().eq()/.is()/.in()/.limit()/
 * .maybeSingle()/.insert()` (backed by an in-memory array per table).
 *
 * This is intentionally NOT a general Supabase mock — it implements exactly
 * the query-builder methods auth/*.ts uses (see roles.ts, authorize.ts,
 * assign-role.ts), in the same "flat query, no embedded resource select"
 * style those files use, so the fake stays honest about what's supported.
 * If a future auth.ts change calls a method this fixture doesn't
 * implement, that call will throw immediately at test time (missing
 * method), which is the desired fail-fast behavior rather than silently
 * returning empty data.
 */

export type FakeRow = Record<string, unknown>;

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

class FakeQueryBuilder {
  private rows: FakeRow[];
  private readonly table: string;
  private readonly db: Map<string, FakeRow[]>;
  private filters: Array<(row: FakeRow) => boolean> = [];
  private singleMode: "none" | "single" | "maybeSingle" = "none";
  private limitCount: number | null = null;
  private pendingInsert: FakeRow[] | null = null;

  constructor(table: string, db: Map<string, FakeRow[]>) {
    this.table = table;
    this.db = db;
    this.rows = db.get(table) ?? [];
  }

  select(_columns?: string) {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
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

  private execute<T>(): QueryResult<T> {
    if (this.pendingInsert) {
      const existing = this.db.get(this.table) ?? [];
      const inserted = this.pendingInsert.map((row, i) => ({
        id: `generated-${this.table}-${existing.length + i}`,
        created_at: "2026-01-01T00:00:00.000Z",
        ...row,
      }));
      this.db.set(this.table, [...existing, ...inserted]);
      return { data: inserted as unknown as T, error: null };
    }

    let result = this.rows.filter((row) => this.filters.every((f) => f(row)));
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

export interface FakeAuthStubs {
  signInWithPassword?: (args: { email: string; password: string }) => Promise<{ data: { user: { id: string } | null }; error: { message: string; status?: number } | null }>;
  signUp?: (args: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
  }) => Promise<{ data: { user: { id: string } | null; session: unknown | null }; error: { message: string; status?: number } | null }>;
  signOut?: () => Promise<{ error: { message: string } | null }>;
  getUser?: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
  getSession?: () => Promise<{ data: { session: unknown | null } }>;
  resetPasswordForEmail?: (email: string, opts: { redirectTo: string }) => Promise<{ error: { message: string } | null }>;
  updateUser?: (attrs: { password?: string }) => Promise<{ error: { message: string } | null }>;
}

/**
 * `seedTables` lets each test pre-populate whichever tables it needs (e.g.
 * `{ users: [...], members: [...], user_roles: [...] }`) without dragging in
 * every table every time.
 */
export function createFakeSupabaseClient(auth: FakeAuthStubs = {}, seedTables: Record<string, FakeRow[]> = {}) {
  const db = new Map<string, FakeRow[]>(Object.entries(seedTables).map(([k, v]) => [k, [...v]]));

  const notImplemented = (name: string) => async () => {
    throw new Error(`fake-supabase-client: auth.${name} was called but no stub was provided for this test.`);
  };

  return {
    auth: {
      signInWithPassword: auth.signInWithPassword ?? notImplemented("signInWithPassword"),
      signUp: auth.signUp ?? notImplemented("signUp"),
      signOut: auth.signOut ?? notImplemented("signOut"),
      getUser: auth.getUser ?? notImplemented("getUser"),
      getSession: auth.getSession ?? (async () => ({ data: { session: null } })),
      resetPasswordForEmail: auth.resetPasswordForEmail ?? notImplemented("resetPasswordForEmail"),
      updateUser: auth.updateUser ?? notImplemented("updateUser"),
    },
    from(table: string) {
      return new FakeQueryBuilder(table, db);
    },
    // Expose the in-memory store so tests can assert on what was inserted.
    __db: db,
  };
}
