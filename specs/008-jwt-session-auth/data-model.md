# Data Model: JWT Session Auth

## Session (not persisted)

A session is a stateless, signed JWT — there is no `sessions` table. Modeled in TypeScript only (`src/bcs/identity-access/domain/session.ts`):

```ts
interface SessionClaims {
  sub: string;              // userId
  role: "admin" | "member";
  exp: number;               // unix seconds, set by signSessionJwt from JWT_EXPIRY_HOURS
}

interface SessionCookieDescriptor {
  name: string;               // constant, e.g. "sh_session"
  value: string;               // "" when clearing (logout)
  httpOnly: true;
  secure: boolean;              // NODE_ENV === "production" (research.md §4)
  sameSite: "lax";
  path: "/";
  maxAge?: number;              // seconds; omitted (or 0) on logout to clear immediately
}
```

**Lifecycle**: created by `login()` (signed, `maxAge` = `JWT_EXPIRY_HOURS * 3600`), read by `authenticateSession()` (verified, not re-signed — no sliding expiry per `context/auth-conventions.md`), invalidated by `logout()` (returns a descriptor with empty value / `maxAge: 0`) or by natural `exp` elapsing (no server-side action needed — `authenticateSession()` simply stops accepting it).

**Validation rules**: `exp` MUST be checked against current time on every `authenticateSession()` call (FR-006). Signature MUST verify against `getJwtSecret()` (FR-010) — malformed/wrong-signature/expired all resolve to `null` identically (spec.md Edge Cases).

## AuditEvent (new: `audit.audit_events`, pulled forward from `003-audit-compliance/001`)

```ts
// src/bcs/audit-compliance/domain/audit-event.ts
interface AuditEvent {
  id: string;                      // uuid, generated
  organizationId: string | null;    // null only for a failed login against an unknown email (no org resolvable)
  actorUserId: string | null;        // set for success and for failure-against-a-real-account; null for failure-against-unknown-email
  actorApiKeyId: null;                // always null for this feature — no API-key-authenticated action writes these events
  action: string;                     // "user.login" | "user.login_failed" | "user.logout"
  resourceType: "user";
  resourceId: string | null;          // the user's id when resolvable, else null (unknown-email failure)
  before: null;                       // no prior-state concept for an auth event
  after: null;                        // no new-state concept for an auth event — see redaction note below
  createdAt: string;                  // iso, set by DB default
}
```

Drizzle table (`src/bcs/audit-compliance/infrastructure/schema.ts`), matching `bcs/audit-compliance/CONTRACT.md`'s shape and `backlog/003-audit-compliance/001`'s column list exactly:

```ts
export const auditEvents = auditSchema.table(
  "audit_events",
  {
    id: id(),
    organizationId: uuid("organization_id").references(() => organizations.id), // nullable — see note below
    actorUserId: uuid("actor_user_id"),
    actorApiKeyId: uuid("actor_api_key_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.organizationId, table.createdAt)],
);
```

**Deviation from `context/database-conventions.md`'s "every table gets `organization_id` not null"**: `audit.audit_events.organization_id` is nullable specifically for the login-against-an-unknown-email case (FR-011), where no organization can be resolved at all (the email doesn't belong to any account) — there is no tenant to attribute the event to. Every other write path this feature adds (successful login, logout, login-failure-against-a-real-account) always supplies a real `organizationId`. This is a narrower exception than a normally-nullable column: only the one FR-011 sub-case produces `null`.

**Redaction** (`record()`'s own responsibility, `src/bcs/audit-compliance/application/record.ts`): before insert, deep-strips any `password_hash`, `key_hash`, or raw-token-shaped field from `before`/`after`. For this feature specifically, `before`/`after` are always `null` for login/logout events (there's no before/after entity state for an auth action — the password is a verification input, never a stored "state"), so redaction has nothing to strip today; the strip logic is still implemented (not skipped) because `003-audit-compliance/001` is a shared write path future BCs' real mutations *will* pass non-null `before`/`after` through.

**No update/delete path**: matches `context/database-conventions.md`'s stated exception — `audit.audit_events` rows are never modified or removed by application code, only by a future retention job (out of scope here, per `003-audit-compliance/002`).
