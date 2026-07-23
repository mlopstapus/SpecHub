# Research: User Accounts & Registration

## 1. Password hashing library: `bcryptjs`, not native `bcrypt`

**Decision**: Use the `bcryptjs` npm package (pure JavaScript, no native/compiled binding) rather than the native `bcrypt` package, with a cost factor of 12.

**Rationale**: The root `Dockerfile`'s runtime stage ships `.next/standalone` output, which only bundles dependencies actually traced from the app's own import graph (per `CLAUDE.md`'s documented gotcha about `postgres`/`drizzle-orm` not being auto-bundled). Native `bcrypt` additionally requires a compiled binary (via `node-gyp`/prebuilt binaries) that must match the exact runtime image's platform/Node ABI — an extra, easy-to-break cross-stage-build concern this project's Dockerfile has already hit non-obvious issues with once (per `CLAUDE.md`'s standalone-output notes). `bcryptjs` implements the identical bcrypt algorithm and hash format (interoperable with hashes produced by the legacy Python `bcrypt` library, verified by the same `$2a$`/`$2b$` prefix and cost-factor encoding), with zero native compilation risk in a standalone Next.js build.

**Alternatives considered**:
- Native `bcrypt` — rejected: adds native-build risk to a Docker pipeline already documented as fragile around standalone tracing, for no correctness benefit (both produce standard bcrypt hashes).
- `argon2`/`scrypt` — rejected: tenet S1 and every existing doc (`context/architecture.md`, `specs/tenets.md`, the constitution) specify bcrypt by name; switching algorithms is a bigger, undiscussed decision than this feature's scope.

## 2. Case-insensitive uniqueness: normalize-on-write, not `citext`/functional index

**Decision**: Lowercase `email` and `username` in the application layer before every insert/update and before every equality comparison; the existing plain-`text` unique constraint on `(organization_id, email)` / `(organization_id, username)` then enforces case-insensitive uniqueness for free, since only the normalized form is ever stored.

**Rationale**: Satisfies the spec's Clarification directly ("values are normalized before comparison and storage"). Avoids introducing the Postgres `citext` extension (a new migration-level dependency with its own operational footprint — `CREATE EXTENSION citext` must run with sufficient privilege on every deployment, including self-hosted installs whose operators this project otherwise tries not to burden) or a functional unique index (`lower(email)`), which would work but adds index-expression complexity for no benefit over simply storing the canonical form.

**Alternatives considered**:
- `citext` column type — rejected: extra extension dependency across every self-hosted deploy for a problem normalize-on-write already solves.
- Functional unique index on `lower(column)` while preserving original casing in the stored value — rejected: preserving original casing has no identified consumer (email/username are login identifiers, not display text — `display_name` already exists for presentation), so the extra index complexity buys nothing here.

## 3. Real `provisionTeamAndAdmin`: compose `createTeam` + a shared, non-authorization-gated user-insert core

**Decision**: `makeProvisionTeamAndAdmin(adminParams)` returns a `ProvisionTeamAndAdmin` callback that, inside `bootstrapOrganization`'s transaction: (1) calls the existing `createTeam` to create the root team, (2) calls a shared internal helper `insertValidatedUser` (not `createUser`) to create the admin `User` row with `role: "admin"`, then (3) calls `teams-repo.update` to set the new team's `owner_id` to the new user's id — mirroring the legacy Python `register_admin`'s exact sequence (`legacy/backend/src/skillcanon_server/services/auth_service.py`: create team → create user → set `team.owner_id`).

`insertValidatedUser` is the domain-invariant core shared by both this bootstrap path and the admin-facing `createUser` (research.md §6) — cross-org team-assignment checking, password-length validation, hashing, case-normalization, and unique-violation translation all live here exactly once. `createUser` wraps it with an admin-authorization check; `provisionTeamAndAdmin` calls it directly, since first-run bootstrap has no existing caller to authorize against (the admin being created *is* the first user in the organization).

**Rationale**: `createUser`'s admin-only authorization check (FR-003) has no valid caller during first-run bootstrap — there is no admin yet. Reusing `createUser` as-is would either require a bypass flag (an authorization check with an escape hatch is a worse invariant than no check at the shared layer) or block bootstrap entirely. Splitting "the actual invariants" from "who's allowed to call this" keeps both paths correct without compromising either: `insertValidatedUser` still enforces every real data invariant (org-scoping, case-insensitive uniqueness, cross-org team rejection, password strength) for both callers.

**Alternatives considered**:
- Give `createUser` an `isBootstrap: boolean` escape hatch — rejected: an authorization check that can be switched off by a caller-supplied flag is barely a check at all, and every future caller of `createUser` would need to remember never to pass `true`.
- Duplicate the validation logic separately in the bootstrap path — rejected: duplicates exactly the invariants Principle III says belong in one place in the domain layer, risking drift (e.g. password-length check added to one path but not the other).

## 4. Entitlement gate: hardcoded stand-in, not a real `billing-entitlements` call

**Decision**: `application/entitlement-gate.ts` exports `assertCoreFeaturesEnabled()`, which throws `EntitlementRequiredError` if a hardcoded local constant is `false` — the constant is `true`, matching `coreFeaturesEnabled`'s documented Free-and-Paid default (`context/entitlements.md`). `registerFirstRunAdmin` calls this before doing any Organization/Team/User provisioning (FR-011).

**Rationale**: `src/bcs/billing-entitlements/` is still an empty barrel (`export {}`) — epic 008 hasn't started, so there is no `requireEntitlement`/`resolveEntitlements()` implementation anywhere in the codebase to call. The backlog item (`backlog/002-identity-access/003-user-accounts-and-registration.md`) explicitly anticipates this: "if `resolveEntitlements()` genuinely can't be called yet, document that as an explicit, temporary constitution exception here..., not a silently skipped gate." This mirrors the identical, already-established pattern in `backlog/003-audit-compliance/002-audit-query-and-retention.md` ("both retention and export gating use a hardcoded Free-tier default rather than a live `resolveEntitlements()` call") and its owning epic's own note ("build it against a hardcoded Free-tier default... and wire in the real entitlement call once epic 008 lands, rather than blocking this epic on billing"). Shaping the call site (`assertCoreFeaturesEnabled()`, called at the top of `registerFirstRunAdmin`) identically to how a real `requireEntitlement(orgId, "coreFeaturesEnabled")` call would look means the eventual swap (tracked in `backlog/008-billing-entitlements/004-entitlement-enforcement-integration.md`, updated in this change) is a one-line replacement, not a redesign.

**Alternatives considered**:
- Skip the gate call entirely until epic 008 exists — rejected: explicitly ruled out by the backlog item itself and by tenet G1's "including features meant for everyone" wording.
- Build a minimal real `resolveEntitlements()`/`requireEntitlement()` inside `billing-entitlements` now — rejected: that BC's actual data model (`billing.entitlements`, per/org overrides, Stripe-sync interaction) is epic 008's own design work, not something this feature (in a different epic) should pre-empt or partially build; doing so risks the real epic 008 implementation having to unwind or conflict with a premature version.

## 5. No REST route or UI built by this feature

**Decision**: This feature stops at the application layer (`src/bcs/identity-access/application/*`, exported via `index.ts`). No `src/app/` route handler or page is added.

**Rationale**: `backlog/007-distribution/001-rest-api-core-routes.md` explicitly lists porting `routers/users.py` (which includes the registration endpoint) as its own requirement, and depends on `backlog/002-identity-access/EPIC.md` completing first — the dependency runs identity-access → Distribution, not the reverse. `backlog/007-distribution/003-web-ui-shell-and-core-pages.md` owns the corresponding UI. Building a route/page here would duplicate work already scoped to that epic, ahead of the error-mapping/session-auth conventions (`context/api-conventions.md`'s `DomainError` mapper, `004-jwt-session-auth.md`'s `authenticateSession`) that Distribution's own features are responsible for establishing.

**Alternatives considered**:
- Build a minimal registration route now to fully close the "first-run registration route" language in the backlog item — rejected: without `authenticateSession`/session cookies (feature `004-jwt-session-auth.md`, not yet built) or Distribution's error-mapping layer, a route built here would need to be substantially reworked once those land, and would cut across epic ownership boundaries (`bcs/identity-access/OWNERSHIP.md` claims `src/app/(auth)/register` UI, but not REST route wiring, which `bcs/distribution/OWNERSHIP.md` owns).

## 6. Authorization (admin-only / self-or-admin) modeled as an application-layer invariant, not deferred

**Decision**: `createUser`, `updateUser`, and `deactivateUser` each take an explicit `actingUser: UserSummary` parameter (the caller's already-resolved identity/role) and enforce FR-003/FR-004/FR-005's authorization rules internally, throwing `NotAuthorizedError` on violation — rather than assuming a future route handler will check `role` before calling in.

**Rationale**: Constitution Principle III requires domain invariants to live in the domain/application layer, not a route handler — and "who is allowed to perform this write" is exactly as much an invariant as "must be unique per organization." Since Distribution's route layer doesn't exist yet (research.md §5), deferring authorization entirely to "whichever future route handler calls this" would leave the invariant unenforced and untested until that epic lands. Taking `actingUser` as a parameter (shaped exactly like the `UserSummary` a future `authenticateSession`/`getUser` call will produce) keeps these functions fully testable now and requires no rework when Distribution's routes start calling them.

**Alternatives considered**:
- Defer all authorization to Distribution's future route handlers — rejected: leaves FR-003/004/005 unenforced and untested for the entire time between this feature and epic 007, and Principle III explicitly disfavors pushing domain invariants into a route handler.
- A separate `authorize()` wrapper/decorator applied at the call site — rejected: more indirection than three straightforward `if (actingUser.role !== "admin") throw ...` checks justify at this scale; matches the plain, explicit style already used by `createOrganization`'s guard and `createTeam`'s cross-org check.
