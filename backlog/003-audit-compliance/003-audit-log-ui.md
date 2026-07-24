---
epic: 003-audit-compliance
feature: 003-audit-log-ui
status: open
dependencies: ["002-audit-query-and-retention.md", "backlog/004-app-shell-and-landing/002-app-shell-and-navigation.md", "backlog/004-app-shell-and-landing/archive/001-design-tokens-and-theming.md"]
---

# Audit Log UI

The settings page where an org admin views (and, if entitled, exports) their audit trail — owned by this BC per `bcs/audit-compliance/OWNERSHIP.md` (`src/app/(app)/settings/audit-log`).

**Scope change (2026-07-23):** per an explicit decision to have the *real, visually-finished* audit trail in place, this feature builds directly from the imported Claude design mockup `SkillCanon Audit.dc.html` (claude.ai/design project `7babdbf3-c063-46b5-84df-ffa9f588d88a`) as the source of truth for layout, copy, and visual tokens — same as every other UI feature in this backlog now does.

**Sequencing update (2026-07-23):** `004-app-shell-and-landing` is being built *before* this feature rather than after it, so this feature no longer needs to build its own standalone shell or locally-scoped tokens (an earlier plan, superseded before any code was written — see that epic's own Notes). This feature now simply composes into the real shell and consumes the real shared tokens directly, like every downstream epic's UI feature does.

**Implementation source (2026-07-23):** this mockup is available through the `claude_design` MCP server (the same one used to import it) — pull the file's actual content (`DesignSync get_file`, project `7babdbf3-c063-46b5-84df-ffa9f588d88a`, path `SkillCanon Audit.dc.html`) rather than re-deriving the design from a screenshot or description. Treat that file as a literal blueprint, not just visual reference: its inline `<style>` block (CSS custom properties for the full color/font system), its exact markup structure (sidebar nav, filter bar, row grid, detail drawer), and its embedded `<script type="text/x-dc">` component logic (the `VERB`/`TRANSPORT`/`RES`/`ACTORS` maps, `deco()`/`diffOf()`/`renderVals()`) are the precise styling and behavior wanted — port them directly into the real Next.js/React/Tailwind implementation (translating the `.dc.html` component-preview format's state/props/`sc-if`/`sc-for` placeholders into real React state, conditionals, and `.map()`), then strip out whatever doesn't carry over (the `x-dc`/`data-dc-script` preview wrapper, `support.js`, the hardcoded mock `EVENTS` array once wired to real `list()` data). Don't restyle from scratch or approximate colors/spacing by eye — copy the actual token values and markup, then adapt.

## Requirements

- [ ] `settings/audit-log` page: paginated, filterable (by free-text search, resource type, actor, transport, date range) view over `list()`, matching the mockup's filter bar (search input, Resource dropdown, Actor dropdown, date-range control, Clear-filters button that only appears when a filter is active)
- [ ] Row list: time (absolute + relative), color-coded action badge (per the verb taxonomy added to `001-audit-event-schema-and-write-path.md`), resource name, actor (avatar-style initial + name + role/type subtext), transport/source badge (web/api/cli/system, colored per the mockup)
- [ ] Detail drawer: clicking a row opens a right-side slide-in drawer showing the action/resource header, a 2x2 meta grid (Actor, Source+IP, Resource+id, Timestamp), a before/after change-diff view (red `−`/green `+` per changed key, "redacted secrets omitted" label), a no-diff state for auth events (login/logout) with explanatory copy, and the event's immutable id in its own footer row
- [ ] Empty state: distinct copy for "no events at all" vs. "no events match these filters" (with a Clear-filters action in the latter case), per the mockup
- [ ] Pagination footer showing the current range, total count, and the org's actual resolved retention window/tier label (see the correction in `002-audit-query-and-retention.md` — never hardcode "90 days (Free)")
- [ ] Export button, visible/enabled only when the org's entitlement allows it (disabled with an upgrade-prompt tooltip otherwise, once `009-billing-entitlements` exists — hidden entirely until then)
- [ ] Admin-only access (matches current role-gating pattern for sensitive settings pages), via the real session-auth middleware built by `004-app-shell-and-landing/002-app-shell-and-navigation.md`
- [ ] Composes into the real app shell from `004-app-shell-and-landing/002-app-shell-and-navigation.md` — a "Settings" nav section containing at least "API keys" and "Audit log", matching the mockup's structure
- [ ] Uses the real shared tokens from `004-app-shell-and-landing/archive/001-design-tokens-and-theming.md` (dark theme, `--bg`/`--panel`/`--surface`/accent teal/etc., Bricolage Grotesque + Hanken Grotesk + Spline Sans Mono fonts, now live in `src/app/globals.css` + `src/shared/ui/`) — no locally-scoped/ad hoc styling

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
- `backlog/004-app-shell-and-landing/002-app-shell-and-navigation.md` (real shell + session-auth middleware this page composes into)
- `backlog/004-app-shell-and-landing/archive/001-design-tokens-and-theming.md` (real shared tokens this page uses)

## Technical Notes

This feature's scope was originally going to include pulling forward a temporary standalone shell and locally-scoped tokens, since `004-app-shell-and-landing` didn't exist yet at the time this file was first written. That epic is now being built first instead (see its own Notes), before any of that temporary version was ever implemented in code — so this feature depends on the real shell/tokens directly rather than building, then later reconciling, a throwaway copy.

The nav markup this page composes into (`004-app-shell-and-landing/002-app-shell-and-navigation.md`) was itself derived from this same `SkillCanon Audit.dc.html` mockup (plus `SkillCanon Governance.dc.html`), so this page's own left-nav requirements above should already match it exactly — flag any drift rather than silently diverging.

This is still a bigger lift than the file's original scope (a thin thing that could wait on a later epic) — that tradeoff was made explicitly to get the real, finished audit trail UI in place, and it went on to establish a standing pattern (every UI-bearing epic now builds its own real page directly, against its own mockup) rather than staying a one-off — see `backlog/003-audit-compliance/EPIC.md`'s Notes and `backlog/004-app-shell-and-landing/EPIC.md` for the resulting backlog restructuring.
