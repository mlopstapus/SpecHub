# Data Model: App Shell & Navigation

This feature adds no persistent table or migration. Its model consists of
read-only contract views and UI state derived from existing Identity & Access
records and Billing & Entitlements defaults.

## AppSessionUser

Identity & Access's live, safe view of the user currently represented by a
session.

| Field         | Type                  | Source                     | Rule                                      |
| ------------- | --------------------- | -------------------------- | ----------------------------------------- |
| `id`          | UUID string           | `identity_access.users.id` | Stable user ID                            |
| `orgId`       | UUID string           | `users.organization_id`    | Tenant owning the user                    |
| `teamId`      | UUID string           | `users.team_id`            | Must join a team in the same organization |
| `role`        | `"admin" \| "member"` | `users.role`               | Re-resolved live, never trusted from JWT  |
| `email`       | string                | `users.email`              | Existing safe session field               |
| `displayName` | string                | `users.display_name`       | Used verbatim in account footer           |
| `teamName`    | string                | `teams.name`               | Joined through current team               |

Validation:

- The user row must exist.
- `users.is_active` must be `true`; otherwise session resolution returns
  `null`.
- The joined team must match both `users.team_id` and
  `users.organization_id`; a missing/mismatched team returns `null`.
- Password hashes, username, timestamps, and raw JWT/cookie material never
  enter this view.

## EntitlementSnapshot

Billing & Entitlements's resolved local values. This feature reads only
`coreFeaturesEnabled`, but the facade uses the canonical catalog shape so later
persisted resolution does not change the consumer.

| Field                     | Type             | Current Free default |
| ------------------------- | ---------------- | -------------------- |
| `coreFeaturesEnabled`     | boolean          | `true`               |
| `maxTeams`                | number or `null` | `null`               |
| `maxApiKeys`              | number or `null` | `5`                  |
| `maxProjects`             | number or `null` | `null`               |
| `maxPromptVersionHistory` | number or `null` | `20`                 |
| `ssoEnabled`              | boolean          | `false`              |
| `auditRetentionDays`      | number           | `7`                  |
| `prioritySupport`         | boolean          | `false`              |
| `seatLimit`               | number or `null` | `null`               |
| `customBranding`          | boolean          | `false`              |

No state transition occurs in this feature. A future Billing implementation
will replace the provisional default resolver with plan defaults merged with
per-organization overrides.

## AppShellAccess

A discriminated union produced before any protected UI renders.

```text
unauthenticated
  └── no user

entitlement-denied
  └── authenticated AppSessionUser (retained server-side for decision context)

allowed
  └── authenticated AppSessionUser passed to AppShell
```

Transitions per request:

1. Missing/expired/tampered/deactivated session → `unauthenticated`.
2. Active session plus disabled/missing `coreFeaturesEnabled` →
   `entitlement-denied`.
3. Active session plus enabled `coreFeaturesEnabled` → `allowed`.

These are request outcomes, not persisted lifecycle states.

## NavItem

Static route metadata with one dynamic destination.

| Field     | Type                        | Rule                                                        |
| --------- | --------------------------- | ----------------------------------------------------------- |
| `key`     | stable string union         | Unique across all nav items                                 |
| `label`   | string                      | Exact product label from spec                               |
| `section` | `"workspace" \| "settings"` | Controls visual grouping                                    |
| `href`    | string                      | Governance interpolates current `teamId`; all others static |

Active-state precedence:

1. `/teams/{teamId}/policies/**` and `/teams/{teamId}/objectives/**` →
   Governance.
2. Other `/teams/**` paths → Teams.
3. Other items match their exact top-level route segment and descendants.
4. A route outside every known section has no active item; composed routes are
   expected to declare one of the known ownership prefixes.
