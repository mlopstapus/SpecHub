import bcrypt from "bcryptjs";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { isUniqueViolation } from "@/shared/db";
import {
  DuplicateUserError,
  InvalidTeamAssignmentError,
  WeakPasswordError,
} from "../domain/user";
import { findById as findTeamById } from "../infrastructure/teams-repo";
import { insert } from "../infrastructure/users-repo";

type Tx = PostgresJsDatabase<Record<string, never>>;

const BCRYPT_COST_FACTOR = 12;
const MIN_PASSWORD_LENGTH = 8;

export interface InsertValidatedUserParams {
  /** Optional client-generated id, passed through to `users-repo.insert` (009-invitations). */
  id?: string;
  organizationId: string;
  teamId: string;
  username: string;
  displayName: string;
  email: string;
  password: string;
  role: "admin" | "member";
}

/**
 * The shared, non-authorization-gated domain-invariant core reused by both
 * `createUser` (admin-facing) and `provisionTeamAndAdmin` (first-run
 * bootstrap, which has no caller to authorize against — research.md §3).
 * Enforces cross-org team assignment (FR-009), password strength (FR-014),
 * case-insensitive uniqueness via lowercase normalization (research.md §2),
 * and bcrypt hashing (FR-007) — exactly once, for both callers.
 */
export async function insertValidatedUser(
  tx: Tx,
  params: InsertValidatedUserParams,
): Promise<{ id: string }> {
  const team = await findTeamById(tx, params.teamId);
  if (!team || team.organizationId !== params.organizationId) {
    throw new InvalidTeamAssignmentError();
  }

  if (params.password.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError();
  }

  const passwordHash = await bcrypt.hash(params.password, BCRYPT_COST_FACTOR);

  try {
    return await insert(tx, {
      ...(params.id ? { id: params.id } : {}),
      organizationId: params.organizationId,
      teamId: params.teamId,
      username: params.username.toLowerCase(),
      displayName: params.displayName,
      email: params.email.toLowerCase(),
      passwordHash,
      role: params.role,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DuplicateUserError(guessViolatedField(err));
    }
    throw err;
  }
}

function guessViolatedField(err: unknown): "email" | "username" {
  const message =
    (err as { message?: string }).message ??
    ((err as { cause?: { message?: string } }).cause?.message as
      | string
      | undefined) ??
    "";
  return message.includes("email") ? "email" : "username";
}
