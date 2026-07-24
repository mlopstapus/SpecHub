# App Shell UI Contract

## Protected route decision

Every route under `src/app/(app)/` is evaluated in this order before its child
content renders:

| Condition                                                                                    | Result                                                                                              |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Cookie missing, JWT invalid/expired, user missing, user deactivated, or current team invalid | Redirect to `/login`; render no shell or child content                                              |
| Active session and `coreFeaturesEnabled` absent/false                                        | Render the access-unavailable page; preserve authentication; render no shell, nav, or child content |
| Active session and `coreFeaturesEnabled=true`                                                | Render `AppShell` with the requested child content                                                  |

Infrastructure failures are not treated as an allowed session and raw cookie or
JWT material is never passed to a Client Component or log message.

## Session identity contract

`authenticateSession(authDb, cookieHeader)` returns:

```ts
type AppSessionUser = {
  id: string;
  orgId: string;
  teamId: string;
  role: "admin" | "member";
  email: string;
  displayName: string;
  teamName: string;
};
```

or `null` for routine invalid-session outcomes, including user deactivation.

## Navigation contract

### Workspace

| Key          | Label      | Destination                       |
| ------------ | ---------- | --------------------------------- |
| `overview`   | Overview   | `/dashboard`                      |
| `prompts`    | Prompts    | `/prompts`                        |
| `governance` | Governance | `/teams/{currentTeamId}/policies` |
| `teams`      | Teams      | `/teams`                          |
| `workflows`  | Workflows  | `/workflows`                      |
| `projects`   | Projects   | `/projects`                       |
| `metrics`    | Metrics    | `/metrics`                        |

### Settings

| Key        | Label     | Destination           |
| ---------- | --------- | --------------------- |
| `apiKeys`  | API keys  | `/settings/api-keys`  |
| `auditLog` | Audit log | `/settings/audit-log` |

Every entry is a real Next.js `Link`, whether or not the destination feature is
already shipped.

## Active-state contract

- Exactly one known nav item receives `aria-current="page"` and the visual
  active treatment for any composed page owned by a listed section.
- Governance matching runs before Teams matching:
  `/teams/{teamId}/policies/**` and `/teams/{teamId}/objectives/**` activate
  Governance; all other `/teams/**` routes activate Teams.
- A top-level destination and its detail descendants activate the same item.
- Path matching respects segment boundaries (`/prompts-x` is not Prompts).

## Shell presentation contract

- Grid columns: `216px minmax(0, 1fr)`.
- Sidebar: `--panel`, full viewport height, vertically persistent.
- Section labels: uppercase mono eyebrow style.
- Nav item: 8×10px padding, 8px radius.
- Active nav item: `--asoft` background and 3px `--a` left marker.
- Account footer is pinned to the sidebar bottom and displays:
  avatar initial, display name, title-cased role, team name, and a decorative
  chevron with no action in this feature.
- Main content is a min-width-safe scrolling composition slot.
- Authenticated app shell is dark-only.
