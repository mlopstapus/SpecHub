# Research: JWT Session Auth

## 1. JWT library: `jose`, not `jsonwebtoken`

**Decision**: Add `jose` (npm) for HS256 signing (`SignJWT`) and verification (`jwtVerify`).

**Rationale**: `jose` is ESM-native (matches this project's module setup), has zero transitive dependencies, and is actively maintained with first-class TypeScript types. `jsonwebtoken` is CommonJS-first, has a materially larger unmaintained-dependency surface, and its `verify()` callback/try-catch API is less ergonomic than `jose`'s promise-based one for the `authenticateSession`/`verifySessionJwt` shape this feature needs (a clean "resolve payload or throw" call). Neither library has native bindings, so the `.next/standalone` bundling gotcha (`CLAUDE.md`) doesn't distinguish them.

**Alternatives considered**:
- `jsonwebtoken` — rejected: CommonJS-first, callback-style API, larger unmaintained transitive dependency tree for no capability this feature needs.
- Hand-rolled HS256 via Node's `crypto` — rejected: reinventing a well-specified, security-sensitive primitive (JWT signing/verification, including constant-time signature comparison) for no benefit over a widely-audited library.

## 2. `JWT_SECRET` validation: extend `shared/config`, mirroring `getConnectionString`

**Decision**: `src/shared/config/index.ts` (currently an empty barrel) gains `getJwtSecret(env?): string`, matching `shared/db/client.ts`'s `getConnectionString` shape exactly: throws if missing, throws if it equals a documented placeholder (`REPLACE_ME`), returns the real value otherwise. Called eagerly (not lazily behind a Proxy) from `infrastructure/jwt.ts`'s module-level sign/verify functions, so the *first* JWT operation after boot — not literal process start — is where the fail-closed check fires, exactly matching how `getConnectionString` already enforces `DATABASE_URL` (this repo has no `instrumentation.ts`/hard process-boot gate for any env var yet; confirmed by its absence and by `client.ts`'s own lazy-Proxy pattern).

**Rationale**: `bcs/identity-access/OWNERSHIP.md` states cross-cutting "config loading" is claimed by Distribution's `shared/config/` per `bcs/distribution/OWNERSHIP.md` — but that path is currently an empty barrel because Distribution's epic (007) hasn't started, and `DATABASE_URL`'s equivalent logic already lives in `shared/db/client.ts` (also nominally Distribution-owned) despite having clearly been built by an earlier infrastructure feature, not epic 007 itself. Placing `getJwtSecret` here keeps all "env var placeholder detection" logic in one discoverable place rather than duplicating the pattern inside `identity-access`, and follows the same precedent that let `client.ts` exist before Distribution's epic began.

**Alternatives considered**:
- Inline `process.env.JWT_SECRET` reads directly inside `identity-access/infrastructure/jwt.ts`, no `shared/config` change — rejected: duplicates the missing/placeholder-detection logic `getConnectionString` already implements once, and scatters "where do we check for insecure defaults" across two places for what is conceptually the same check (tenet C2).
- A hard Next.js `instrumentation.ts` boot hook that calls `getJwtSecret()` explicitly at process start — rejected as *this feature's* job: no such hook exists anywhere in the repo yet for any env var (including `DATABASE_URL`), so adding one here would be new infrastructure outside this feature's scope, not a JWT-specific decision. The lazy-throws-on-first-use behavior already satisfies spec.md's SC-004 in the same sense the existing DB check satisfies its own boot-time framing — both fail loudly before any real work (a query, a login) succeeds with a bad secret.

## 3. Session representation: no persisted session row, cookie descriptor as a plain value object

**Decision**: `login()`/`logout()` return a `SessionCookieDescriptor` (`{ name, value, httpOnly: true, secure, sameSite: "lax", path: "/", maxAge? }`) rather than calling into any HTTP/cookie framework. `authenticateSession()` takes the raw `Cookie` request-header string (or `null`/`undefined`), not a framework-specific request type (`NextRequest`, etc.).

**Rationale**: Per research.md §5 below, no route handler exists in this feature to hold a real `Request`/`NextRequest` object, and `identity-access` must not import Next.js route types regardless (Principle II — a BC's application layer stays framework-agnostic; only `src/app/**` is allowed to know about Next.js). A plain descriptor object is exactly what a future `NextResponse.cookies.set(descriptor.name, descriptor.value, descriptor)`-style call needs, with zero translation layer, while keeping every function here fully unit-testable today without spinning up a Next.js request/response.

**Alternatives considered**:
- Return a raw `Set-Cookie` header string — rejected: pushes attribute-order/formatting concerns onto this feature for no benefit, when Distribution's route handler will use the framework's own cookie API rather than raw string-building anyway.
- Persist a `sessions` table (DB-backed, revocable sessions) — rejected: contradicts `context/auth-conventions.md`'s explicit "carries forward the current JWT approach" decision and `bcs/identity-access/CONTRACT.md`'s stability guarantee; a stateless JWT is the already-decided design, not this feature's choice to revisit.

## 4. Cookie `secure` flag: `NODE_ENV !== "production"` for "local dev"

**Decision**: The cookie descriptor's `secure` field is `process.env.NODE_ENV === "production"`.

**Rationale**: `NODE_ENV` is the standard Next.js/Node signal for this exact distinction (set automatically by `next dev` vs. `next build && next start`), and no other "local dev vs. not" flag exists anywhere in this codebase. This is a different axis from `identity-access/domain/deployment-mode.ts`'s `isSelfHosted()` (`STRIPE_ENABLED`), which distinguishes self-hosted-vs-SaaS *deployment topology*, not *local-machine-vs-deployed environment* — a self-hosted production deployment must still get `secure: true`, so reusing `isSelfHosted()` here would be wrong.

**Alternatives considered**:
- A new dedicated `IS_LOCAL_DEV` env var — rejected: `NODE_ENV` already carries this signal reliably in every Next.js deployment path this project uses (Docker Compose sets it via the build); inventing a parallel flag risks the two drifting out of sync.

## 5. No REST route or UI built by this feature

**Decision**: This feature stops at the application layer (`src/bcs/identity-access/application/*` and `src/bcs/audit-compliance/application/*`, each exported via their own `index.ts`). No `src/app/` route handler or page is added, despite the originating backlog item's literal "Login endpoint" wording.

**Rationale**: Directly matches `007-user-accounts-registration`'s identical, explicitly-documented precedent for this same epic (`specs/007-user-accounts-registration/research.md` §5, and the archived `backlog/002-identity-access/archive/003-user-accounts-and-registration.md`'s Technical Notes: "the actual HTTP route wiring is owned by `backlog/007-distribution/001-rest-api-core-routes.md`... depends on this epic completing first, not the reverse"). `backlog/007-distribution/001-rest-api-core-routes.md`'s own port list (`routers/{teams,projects,prompts,policies,objectives,workflows,apikeys,users}.py`) does not include `auth.py`, but that item's own requirement ("Every route authenticates via `authenticateSession` (cookie) for the web UI's own calls") confirms Distribution is the intended caller of the contract functions this feature builds, not their implementer. `bcs/identity-access/OWNERSHIP.md` does list `src/app/(auth)/login`/`register` UI paths under this BC's eventual ownership, but that is a final-state maintenance map (the same file also lists `/settings/*`, none of which any epic-002 feature has built yet either) — not a claim that *this* feature must build the page now, any more than `007-user-accounts-registration` was obligated to build `/register`.

**Alternatives considered**:
- Build a minimal login route + page now, since the backlog item names it explicitly — rejected: would duplicate work `007-distribution` already owns, ahead of that epic's error-mapping conventions (`context/api-conventions.md`'s `DomainError` mapper) being wired into any actual route yet, and breaks the same-epic precedent `007-user-accounts-registration` just set one feature ago.

## 6. Login failure: no new error class, `login()` returns `null`

**Decision**: `login(db, email, password)` returns `Promise<{ user: UserSummary; cookie: SessionCookieDescriptor } | null>` — `null` for both "no such user" and "wrong password" (FR-002's non-enumeration requirement), not a thrown error. `authenticateSession()` likewise returns `Promise<UserSummary | null>`, never throwing for a missing/expired/tampered session (FR-005/FR-010).

**Rationale**: A thrown error for an expected, routine outcome (wrong credentials, expired session) would force every future caller (Distribution's route handler) to wrap every call in try/catch to distinguish "not logged in" from "something actually broke" — `null` is the correct signal for an expected negative result, matching this feature's own FR wording ("returning 'no user' — never an error"). Real infrastructure failures (e.g. the audit write failing per FR-013) *do* throw, since those are unexpected and must not be silently swallowed into a `null`.

**Alternatives considered**:
- A `LoginResult` discriminated union (`{ ok: true, ... } | { ok: false, reason }`) — rejected: `reason` would either have to stay generic enough not to leak the email-enumeration signal (making it no more useful than `null`) or risk a future caller accidentally branching on it in a way that reintroduces enumeration; `null` is simpler and structurally prevents that mistake.

## 7. Audit event write path for a non-mutating action (login/logout)

**Decision**: Login and logout each open their own `db.transaction()` (not `withAudit()`, which requires a paired `mutationFn` that doesn't exist here — there is no row being mutated by a login) and call `record(tx, event)` directly inside it, immediately before returning success. If `record()` throws, the transaction rolls back (a no-op for a pure read, but consistent) and the error propagates out of `login()`/`logout()` rather than being swallowed — satisfying FR-013 ("audit write failure blocks reporting success") without misusing a wrapper built for the different shape (mutation + audit) `withAudit()` was designed for.

**Rationale**: `shared/db/with-audit.ts`'s own doc comment is explicit that `auditWriteFn` pairs with a `mutationFn` whose effect must commit-or-rollback together; login has no such mutation. Reusing `withAudit()` anyway (e.g. passing a no-op `mutationFn`) would be a misleading call site — a future reader would reasonably assume some row is being mutated. A plain `db.transaction()` wrapping just the audit insert (login's credential check is a read, needing no transaction of its own, but the surrounding transaction costs nothing and keeps the "audit write must complete before success is reported" invariant enforced the same way, structurally, as every other mutation+audit pair in the codebase) is the accurate shape.

**Alternatives considered**:
- Call `record()` outside any transaction, after credential verification, and check its resolved promise before returning — rejected: functionally similar, but loses the "structurally identical to `withAudit()`'s guarantee" property or requires re-deriving it as this feature's own scale, adding more code to reach the same end state than borrowing `db.transaction()` semantics.
- Extend `withAudit()` to accept an optional no-op `mutationFn` — rejected: expands a shared kernel primitive's contract for this one caller's convenience, when a direct `db.transaction()` call already expresses the actual shape (audit-only, no mutation) precisely.
