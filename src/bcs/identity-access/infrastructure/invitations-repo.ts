import { and, eq, gt, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { invitations } from "./schema";

type Tx = PostgresJsDatabase<Record<string, never>>;

export interface InsertInvitationParams {
  /** Optional client-generated id — lets a caller (e.g. `inviteUser`) know the row's id before the insert commits, for use in the same transaction's audit event. Omit to let the column default apply. */
  id?: string;
  organizationId: string;
  teamId: string;
  email: string;
  role: "admin" | "member";
  token: string;
  invitedById: string;
  expiresAt: Date;
}

export async function insert(
  tx: Tx,
  params: InsertInvitationParams,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(invitations)
    .values({
      ...(params.id ? { id: params.id } : {}),
      organizationId: params.organizationId,
      teamId: params.teamId,
      email: params.email,
      role: params.role,
      token: params.token,
      invitedById: params.invitedById,
      expiresAt: params.expiresAt,
    })
    .returning({ id: invitations.id });
  if (!row) {
    throw new Error("Invitation insert returned no row.");
  }
  return row;
}

export async function findByToken(tx: Tx, token: string) {
  const [row] = await tx
    .select()
    .from(invitations)
    .where(eq(invitations.token, token));
  return row;
}

/** `undefined` if the id exists but belongs to a different organization — used for cross-org checks (M3). */
export async function findByOrgAndId(
  tx: Tx,
  organizationId: string,
  id: string,
) {
  const [row] = await tx
    .select()
    .from(invitations)
    .where(
      and(eq(invitations.id, id), eq(invitations.organizationId, organizationId)),
    );
  return row;
}

/**
 * Any invitation for `(organizationId, email)` that is still pending: not
 * accepted, not revoked, and not yet expired (research.md §8). Used by
 * `inviteUser`'s duplicate-invitation check.
 */
export async function findActivePendingByEmail(
  tx: Tx,
  organizationId: string,
  email: string,
) {
  return tx
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    );
}

export async function listByOrganization(tx: Tx, organizationId: string) {
  return tx
    .select()
    .from(invitations)
    .where(eq(invitations.organizationId, organizationId))
    .orderBy(invitations.createdAt);
}

/**
 * Conditional single-winner accept (research.md §6): only succeeds while
 * `accepted_at`/`revoked_at` are both still null *and* `expires_at` is still
 * in the future — the same three conditions `deriveInvitationState` checks,
 * enforced atomically so a request that raced past the expiry boundary
 * between the initial lookup and this call can't still sneak through.
 * Returns `undefined` otherwise (already accepted, already revoked, or now
 * expired) so the caller can react to the now-current state rather than
 * proceeding as if it had won the race.
 */
export async function markAccepted(tx: Tx, id: string) {
  const [row] = await tx
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(
      and(
        eq(invitations.id, id),
        isNull(invitations.acceptedAt),
        isNull(invitations.revokedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .returning();
  return row;
}

export async function markRevoked(tx: Tx, id: string) {
  await tx
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(eq(invitations.id, id));
}
