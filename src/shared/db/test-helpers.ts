import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createRoleClient } from "./client";

/**
 * Matches the app role provisioned by drizzle/migrations/0000_create_schemas.sql.
 * Only ever reachable on a fresh, throwaway Testcontainers instance.
 */
const APP_ROLE = "skillcanon_app";
const APP_ROLE_PASSWORD = "changeme_in_production";
/** Matches the auth role provisioned by drizzle/migrations/0007_identity_access_rls.sql. */
const AUTH_ROLE = "skillcanon_auth";
const AUTH_ROLE_PASSWORD = "changeme_in_production";

export interface TestDb {
  /** Drizzle client connected as the migration/owner role — owns all seven schemas, bypasses RLS. */
  ownerDb: ReturnType<typeof createRoleClient>;
  /** Drizzle client connected as the dedicated least-privileged app role — subject to RLS. */
  appDb: ReturnType<typeof createRoleClient>;
  /**
   * Drizzle client connected as the credential-resolution/bootstrap role —
   * unrestricted by organization within `identity_access` only, no access
   * elsewhere (011-tenant-isolation-rls). Used by tests exercising `login`,
   * `authenticateSession`, `authenticateApiKey`, `acceptInvitation`,
   * `createOrganization`/`bootstrapOrganization`, and as the fixture-setup
   * connection for every other identity-access test.
   */
  authDb: ReturnType<typeof createRoleClient>;
  ownerUrl: string;
  appUrl: string;
  authUrl: string;
  teardown: () => Promise<void>;
}

/**
 * Starts an ephemeral Postgres container, applies the current migrations
 * against it as the owner role, and returns clients for both DB roles.
 * Per context/testing-strategy.md: RLS cannot be meaningfully unit-tested
 * with a mock, so every kernel integration test uses a real instance.
 */
export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const ownerUrl = container.getConnectionUri();

  const ownerDb = createRoleClient(ownerUrl, { prepare: false });
  await migrate(ownerDb, { migrationsFolder: "./drizzle/migrations" });

  const appUrl = new URL(ownerUrl);
  appUrl.username = APP_ROLE;
  appUrl.password = APP_ROLE_PASSWORD;
  const appDb = createRoleClient(appUrl.toString(), { prepare: false });

  const authUrl = new URL(ownerUrl);
  authUrl.username = AUTH_ROLE;
  authUrl.password = AUTH_ROLE_PASSWORD;
  const authDb = createRoleClient(authUrl.toString(), { prepare: false });

  return {
    ownerDb,
    appDb,
    authDb,
    ownerUrl,
    appUrl: appUrl.toString(),
    authUrl: authUrl.toString(),
    teardown: async () => {
      await container.stop();
    },
  };
}
