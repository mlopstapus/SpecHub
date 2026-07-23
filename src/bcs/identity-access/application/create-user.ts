import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { NotAuthorizedError, type UserSummary } from "../domain/user";
import { insertValidatedUser } from "./insert-validated-user";

type Tx = PostgresJsDatabase<Record<string, never>>;

export interface CreateUserParams {
  teamId: string;
  username: string;
  displayName?: string;
  email: string;
  password: string;
  role?: "admin" | "member";
}

/**
 * Creates a user within `actingUser.orgId` only — never a caller-supplied
 * organization (FR-003). Requires an admin caller; delegates every actual
 * domain invariant (team assignment, password strength, uniqueness,
 * hashing) to the shared `insertValidatedUser` core.
 */
export async function createUser(
  tx: Tx,
  actingUser: UserSummary,
  params: CreateUserParams,
): Promise<{ id: string }> {
  if (actingUser.role !== "admin") {
    throw new NotAuthorizedError();
  }

  return insertValidatedUser(tx, {
    organizationId: actingUser.orgId,
    teamId: params.teamId,
    username: params.username,
    displayName: params.displayName ?? params.username,
    email: params.email,
    password: params.password,
    role: params.role ?? "member",
  });
}
