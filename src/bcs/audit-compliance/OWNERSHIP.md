# Audit & Compliance — Ownership

**Owner:** Ben Anderson

## Folder Ownership

| Path | Ownership level |
|---|---|
| `/bcs/audit-compliance/` | Full |
| `src/bcs/audit-compliance/` | Full |
| `src/app/(app)/settings/audit-log` (UI) | Full |

## Database Ownership

Postgres schema: `audit`

| Schema / Table | Notes |
|---|---|
| `audit.audit_events` | Append-only; indexed on `(organization_id, created_at)` for retention pruning and paginated queries |

## Shared Resource Ownership

None.

## Dependencies (owned by others)

| Resource | Owned by BC |
|---|---|
| `resolveEntitlements(orgId).auditRetentionDays` | Billing & Entitlements |
| Org/user existence for filter validation | Identity & Access |
