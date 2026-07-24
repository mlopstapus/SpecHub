# API & Error Conventions

**Status:** Decided
**Decided:** 2026-07-21
**Backlog item:** `backlog/000-foundations/004-api-and-error-conventions.md`

## Error shape

A single `DomainError` base class (discriminated by a `code` field) that every BC's application service throws. Distribution owns one mapper that translates a `DomainError` into a REST response and into an MCP tool error, in one place — no route handler or MCP tool handler re-implements this mapping.

```ts
class DomainError extends Error {
  code: string;          // e.g. "POLICY_NOT_FOUND", "API_KEY_EXPIRED", "ENTITLEMENT_LIMIT_REACHED"
  httpStatus: number;    // set once per code, in the mapper, not scattered per throw site
  details?: Record<string, unknown>; // field-level validation info, safe to serialize
}
```

REST error body:

```json
{ "error": { "code": "POLICY_NOT_FOUND", "message": "Policy not found", "details": {} } }
```

MCP tool errors carry the same `code`/`message` in the tool's error response so a client sees the same underlying failure regardless of transport — directly satisfying tenet C1's "consistent on every transport" requirement, since an error path is exactly where a transport could silently skip a check the other enforces.

## Status code table

| `DomainError.code` pattern | HTTP status |
|---|---|
| `*_NOT_FOUND` | 404 |
| `*_UNAUTHORIZED` / auth failures | 401 |
| `*_FORBIDDEN` / cross-tenant denial (M3) | 403 |
| `*_VALIDATION_FAILED` | 422 |
| `ENTITLEMENT_REQUIRED` (boolean gate off, tenet G1) | 403 |
| `ENTITLEMENT_LIMIT_REACHED` (numeric cap hit) | 402 or 403 (402 if it's a billing upsell prompt, 403 if it's a hard cap) — see `context/feature-gating.md` |
| `*_CONFLICT` (uniqueness violation) | 409 |
| Unhandled / unexpected | 500, generic message, full error only in server logs (never in the response body — no stack traces or internals leaked to the client) |

## API versioning

**No versioning at launch** — routes live under `/api/`, not `/api/v1/`. The only consumer is the bundled frontend, shipped from the same repo, so there's no independent client to break. Revisit and introduce `/api/v1/` only once a third-party API consumer exists that needs a compatibility guarantee.

## Pagination

Carry forward the current **page/page_size** (offset-based) convention from the Python API rather than switching to cursor pagination. Prompt/policy/team lists are not at a scale (millions of rows per org) where offset pagination's performance ceiling matters, and keeping the existing convention avoids an unforced frontend rewrite during the TS port.

## Rate limiting

**Deferred, explicitly.** No rate limiting is implemented at launch. Reasoning: pre-launch there's no multi-tenant noisy-neighbor exposure yet (single self-hosted org, or a small number of early SaaS orgs), and adding rate limiting later is additive (a middleware layer in Distribution) rather than something that needs to be designed into the data model now. Revisit before onboarding SaaS customers at meaningful scale, or sooner if a single API key's usage pattern becomes an operational problem.

## Logging schema & format

**Structured JSON logs, emitted through one shared module** (`shared/logging`, built on `pino`) — no BC or route handler calls `console.log`/`console.error` directly, and no BC configures its own logger instance. This is the same "one place owns the cross-cutting concern" pattern as the `DomainError` mapper above, and it's what makes the error-mapping table's `code` values actually greppable/queryable once logs land in whatever aggregator the deployment uses (CloudWatch Logs on the SaaS, stdout for self-host).

### Fields

Every log line is a single JSON object with these fields, in this order:

| Field | Type | Always present? | Notes |
|---|---|---|---|
| `time` | ISO 8601 string | Yes | UTC |
| `level` | `"debug" \| "info" \| "warn" \| "error"` | Yes | |
| `msg` | string | Yes | Short, human-readable, no interpolated secrets (tenet S3) |
| `requestId` | uuid | Yes, for any log inside a request/tool-call lifecycle | Generated once per REST request or MCP tool call, threaded through via `AsyncLocalStorage` — not passed as an explicit parameter through every function call |
| `bc` | string | Yes | Which bounded context emitted the line, e.g. `"governance"` — set once when a BC's logger child instance is created, not per call site |
| `transport` | `"rest" \| "mcp"` | Yes, at the Distribution boundary and below | Omitted for logs emitted outside a request context (startup, scheduled jobs) |
| `orgId` | uuid \| null | When resolvable | `null` pre-auth (e.g. a failed login attempt has no resolved org yet) |
| `userId` | uuid \| null | When resolvable | Same rule as `orgId` |
| `code` | string | Only on `warn`/`error` from a caught `DomainError` | Matches the `DomainError.code` from the error-shape section above — this is the field that makes "how often does `ENTITLEMENT_LIMIT_REACHED` fire" a log query, not a grep |
| `durationMs` | number | On request/tool-call completion logs only | |
| `err` | object (`{ message, stack, code }`) | On `error` only | `pino`'s standard error serializer; stack traces go to logs, never to the client (see status code table above) |

No other ad hoc fields are added at arbitrary call sites — if a new cross-cutting field is needed, it's added to this table and the shared module, not invented inline by one BC.

### What's explicitly excluded

Per tenet S3, the shared logger's error serializer and a request-body redaction helper strip: raw JWTs, raw API keys (even truncated/prefixed), passwords, and Stripe webhook payloads' raw secret fields. This is enforced once in `shared/logging`'s serializer config, not left to each call site to remember — the same failure mode tenet S3 already documents (`mcp/tools.py` logging `api_key_raw[:12]`) is exactly what a shared, opinionated logger prevents from recurring.

### Relationship to the audit log

This is **operational logging** (debugging, ops visibility), not the audit log (`audit.audit_events`, tenet C1) — the two are separate systems with separate storage and separate purposes. A mutation gets both: an audit event (permanent, queryable by compliance, written in the same transaction as the mutation) and an operational log line (short-retention, for debugging, written via `shared/logging`). Neither substitutes for the other — see `architecture.md`'s Audit & Compliance failure-mode row for why the audit write is transactionally guaranteed in a way operational logs deliberately aren't.

### Usage pattern

```ts
// inside a BC's application layer
import { getLogger } from "@/shared/logging";
const log = getLogger("governance"); // sets `bc` once

log.info({ orgId, requestId }, "resolving policy chain");
log.error({ orgId, requestId, code: err.code, err }, "policy resolution failed");
```

`getLogger(bcName)` is the only way to obtain a logger — there is no default/root logger BCs can grab instead, which is what keeps `bc` populated on every line without per-call-site discipline.

## Deliverable status

Error shape, status codes, versioning, pagination, and rate limiting are settled. This document lands before the `distribution` epic (formerly referenced as `008-distribution`) starts.
