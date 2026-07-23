---
epic: 003-audit-compliance
feature: 003-audit-log-ui
status: open
dependencies: ["002-audit-query-and-retention.md"]
---

# Audit Log UI

The settings page where an org admin views (and, if entitled, exports) their audit trail — owned by this BC per `bcs/audit-compliance/OWNERSHIP.md` (`src/app/(app)/settings/audit-log`).

**Scope change (2026-07-23):** per an explicit decision to have the *real, visually-finished* audit trail in place by the end of this epic — not a functional-but-unstyled placeholder waiting on epic 007/009 — this feature now also pulls forward a minimal app shell and the page's final visual design, both normally owned by later epics. See Technical Notes for exactly what's pulled forward, from where, and how it gets reconciled later. Build directly from the imported Claude design mockup `SkillCanon Audit.dc.html` (claude.ai/design project `7babdbf3-c063-46b5-84df-ffa9f588d88a`) as the source of truth for layout, copy, and visual tokens.

**Implementation source (2026-07-23):** this mockup is available through the `claude_design` MCP server (the same one used to import it) — pull the file's actual content (`DesignSync get_file`, project `7babdbf3-c063-46b5-84df-ffa9f588d88a`, path `SkillCanon Audit.dc.html`) rather than re-deriving the design from a screenshot or description. Treat that file as a literal blueprint, not just visual reference: its inline `<style>` block (CSS custom properties for the full color/font system), its exact markup structure (sidebar nav, filter bar, row grid, detail drawer), and its embedded `<script type="text/x-dc">` component logic (the `VERB`/`TRANSPORT`/`RES`/`ACTORS` maps, `deco()`/`diffOf()`/`renderVals()`) are the precise styling and behavior wanted — port them directly into the real Next.js/React/Tailwind implementation (translating the `.dc.html` component-preview format's state/props/`sc-if`/`sc-for` placeholders into real React state, conditionals, and `.map()`), then strip out whatever doesn't carry over (the `x-dc`/`data-dc-script` preview wrapper, `support.js`, the hardcoded mock `EVENTS` array once wired to real `list()` data). Don't restyle from scratch or approximate colors/spacing by eye — copy the actual token values and markup, then adapt.

## Requirements

- [ ] `settings/audit-log` page: paginated, filterable (by free-text search, resource type, actor, transport, date range) view over `list()`, matching the mockup's filter bar (search input, Resource dropdown, Actor dropdown, date-range control, Clear-filters button that only appears when a filter is active)
- [ ] Row list: time (absolute + relative), color-coded action badge (per the verb taxonomy added to `001-audit-event-schema-and-write-path.md`), resource name, actor (avatar-style initial + name + role/type subtext), transport/source badge (web/api/cli/system, colored per the mockup)
- [ ] Detail drawer: clicking a row opens a right-side slide-in drawer showing the action/resource header, a 2x2 meta grid (Actor, Source+IP, Resource+id, Timestamp), a before/after change-diff view (red `−`/green `+` per changed key, "redacted secrets omitted" label), a no-diff state for auth events (login/logout) with explanatory copy, and the event's immutable id in its own footer row
- [ ] Empty state: distinct copy for "no events at all" vs. "no events match these filters" (with a Clear-filters action in the latter case), per the mockup
- [ ] Pagination footer showing the current range, total count, and the org's actual resolved retention window/tier label (see the correction in `002-audit-query-and-retention.md` — never hardcode "90 days (Free)")
- [ ] Export button, visible/enabled only when the org's entitlement allows it (disabled with an upgrade-prompt tooltip otherwise, once epic 008 exists — hidden entirely until then)
- [ ] Admin-only access (matches current role-gating pattern for sensitive settings pages) — requires wiring session auth into a Next.js route/middleware for the first time in this codebase (see Technical Notes)
- [ ] **Pulled-forward minimal app shell:** a left nav (workspace sections + a Settings section containing at least "API keys" and "Audit log", matching the mockup's structure) and top-level page chrome, scoped only to hosting this page — not a general-purpose shell for every future page
- [ ] **Pulled-forward visual design:** apply the mockup's actual color/typography/spacing tokens (dark theme, `--bg`/`--panel`/`--surface`/accent teal/etc., Bricolage Grotesque + Hanken Grotesk + Spline Sans Mono fonts) directly to this page and its minimal shell, rather than shipping in default shadcn styling and waiting for epic 009

## Acceptance Criteria

- [ ] Non-admin users cannot access the page (redirected or 403)
- [ ] Filtering by search, resource type, actor, transport, and date range (alone and combined) returns correctly scoped results, and Clear filters resets all of them
- [ ] Page renders correctly with zero events (empty state), with active filters that match nothing (the other empty state), and with a large event count (pagination works)
- [ ] Opening a row's detail drawer shows the correct before/after diff for a mutation event, and the correct "no diff" copy for a login/logout event
- [ ] Redacted fields (`password_hash`, `key_hash`, raw tokens) never render in the diff view, even though the mockup's own sample data includes a `key_hash` field — this is a real behavior to verify against `record()`'s redaction, not just mockup fidelity
- [ ] The page visually matches the `SkillCanon Audit.dc.html` mockup (colors, type, spacing, drawer behavior)

## Open Questions

- None currently.

## Dependencies

- `002-audit-query-and-retention.md`

## Technical Notes

**What's being pulled forward, and from where** (documented here per this repo's established forward-pull convention — see the reciprocal notes left on the other side):

- **From `007-distribution/003-web-ui-shell-and-core-pages.md`** (epic 007, not started): that feature owns the *real* app shell (nav, auth-gated routing, composing every BC's settings page). This feature builds a minimal, audit-log-scoped stand-in instead of waiting — the nav markup/structure should be lifted close-to-verbatim from the mockup so epic 007 can generalize it later rather than redesign it. When epic 007 starts, it should absorb this shell into the real one and delete the standalone copy — not maintain two shells. A reciprocal note is left on that feature file.
- **From `009-ui-redesign/001-design-tokens-and-theming.md`** and **`009-ui-redesign/007-settings-and-admin-views-redesign.md`** (epic 009, not started, normally the *only* place visual design gets applied): this feature applies the mockup's tokens directly and locally (e.g. as CSS custom properties or a Tailwind theme extension scoped to this page) rather than waiting for `context/design-system.md` to formalize a repo-wide token system. When epic 009 starts, `001-design-tokens-and-theming.md` should extract the same values into the shared token system, and `007-settings-and-admin-views-redesign.md` should point this page at the shared tokens instead of its local copy, reconciling any drift rather than restyling from scratch. Reciprocal notes are left on both files.
- Also requires wiring session auth (from `002-identity-access/004-jwt-session-auth.md`'s httpOnly JWT cookie) into an actual Next.js route/middleware — nothing in the codebase does this yet since no `(app)` route exists before this feature. Keep this middleware minimal/reusable so epic 007 can build on it rather than replace it.

This is a bigger lift than the file's original scope (a thin thing that could wait on 007/009) — that tradeoff was made explicitly to get the real, finished audit trail UI in place by the end of this epic, not to establish a new general pattern of epics 003/007/009 routinely overlapping like this.
