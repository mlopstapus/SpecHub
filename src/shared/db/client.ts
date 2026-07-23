import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const PLACEHOLDER_MARKER = "REPLACE_ME";

/**
 * Reads a DB connection-string env var and fails loudly (constitution
 * Principle VI / FR-012) rather than silently connecting with a missing or
 * still-placeholder value. `env` defaults to `process.env` and is only
 * overridden in tests.
 */
export function getConnectionString(
  name: "DATABASE_URL" | "MIGRATION_DATABASE_URL" | "AUTH_DATABASE_URL",
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env[name];
  if (!value) {
    throw new Error(
      `${name} is missing. Set it in your environment before starting the app (see .env.example).`,
    );
  }
  if (value.includes(PLACEHOLDER_MARKER)) {
    throw new Error(
      `${name} is still set to its documented placeholder value. Replace it with a real connection string before starting the app.`,
    );
  }
  return value;
}

/**
 * Internal factory — not exported from the public barrel (index.ts).
 * Used by this module's own `db` export, by drizzle.config.ts, and by
 * test-helpers.ts to open a second connection as the migration/owner role.
 */
export function createRoleClient(
  url: string,
  options: { prepare?: boolean } = {},
): PostgresJsDatabase {
  const sql = postgres(url, { prepare: options.prepare ?? false });
  return drizzle(sql);
}

let lazyDb: PostgresJsDatabase | undefined;

function getDb(): PostgresJsDatabase {
  if (!lazyDb) {
    lazyDb = createRoleClient(getConnectionString("DATABASE_URL"), {
      prepare: false,
    });
  }
  return lazyDb;
}

/**
 * The shared Drizzle client every bounded context imports, connected via the
 * dedicated least-privileged runtime app role (never the schema-owning
 * migration role — see FR-010/research.md). `prepare: false` keeps this
 * compatible with a transaction-mode PgBouncer pool in front of Postgres
 * (FR-011).
 *
 * Lazily initialized on first use so merely importing this module (e.g. from
 * a test, or during typecheck/build tooling) doesn't eagerly open a
 * connection or trigger the FR-012 placeholder/missing-env-var check.
 */
export const db: PostgresJsDatabase = new Proxy({} as PostgresJsDatabase, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

let lazyAuthDb: PostgresJsDatabase | undefined;

function getAuthDb(): PostgresJsDatabase {
  if (!lazyAuthDb) {
    lazyAuthDb = createRoleClient(getConnectionString("AUTH_DATABASE_URL"), {
      prepare: false,
    });
  }
  return lazyAuthDb;
}

/**
 * Connected via `skillcanon_auth` — a role scoped to `identity_access` only,
 * unrestricted by organization there, but with no access to any other
 * schema (011-tenant-isolation-rls). Used only by identity-access flows that
 * must resolve an identity or bootstrap a tenant before any organization
 * context exists: `login`, `authenticateSession`, `authenticateApiKey`,
 * `acceptInvitation`, and `createOrganization`/`bootstrapOrganization`. Every
 * other exposed function in this codebase expects the ordinary `db` above.
 */
export const authDb: PostgresJsDatabase = new Proxy({} as PostgresJsDatabase, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuthDb() as object, prop, receiver);
  },
});
