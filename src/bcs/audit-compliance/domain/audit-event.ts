/**
 * General read/write shape, reused by every future BC that calls `record()`
 * — not specific to any one feature. `actorApiKeyId`/`before`/`after` are
 * typed loosely because a future non-auth mutation will populate them; this
 * feature's own call sites (identity-access's login/logout) always pass
 * `null` for the fields an auth event has no value for.
 */
export interface AuditEvent {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  actorApiKeyId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: unknown | null;
  after: unknown | null;
  createdAt: Date;
}

/** Input to `record()` — everything but the DB-generated `id`/`createdAt`. */
export interface NewAuditEvent {
  organizationId: string | null;
  actorUserId: string | null;
  actorApiKeyId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before?: unknown | null;
  after?: unknown | null;
}

/**
 * Keys stripped (deeply, anywhere in the object) from `before`/`after`
 * before storage — never store secret material even inside an audit diff
 * (tenet S3 extended to the audit trail).
 */
export const REDACTED_KEYS = ["password_hash", "key_hash", "token", "raw_token", "jwt"] as const;
