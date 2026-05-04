# Design System gaps, workarounds and cost

This document catalogues everywhere `messaging-next` has had to work
around `@ogcio/design-system-react` — either because the component / prop
we needed does not exist, because the bundle ships something incomplete,
or because the app's runtime assumptions (Next.js App Router, `next-intl`,
no Tailwind build) diverge from what DS assumes.

It is a companion to [`../../docs/gi-classes.md`](../../docs/gi-classes.md)
(the reference of the 1 040 `gi-*` classes compiled into the DS bundle)
and supersedes the ad‑hoc `DS gap:` / `Removable when DS …` comments
scattered across the app's CSS and TSX. Each entry keeps a pointer back
to the exact file/lines that implement the workaround.

- **DS consumed:** `@ogcio/design-system-react@1.34.0` (with
  `@ogcio/design-system-tailwind` as the Tailwind preset that feeds it).
- **Upstream docs:** [`ogcio/govie-ds` monorepo](https://github.com/ogcio/govie-ds).
- **When to edit this file:** whenever you add or remove a `DS gap:` /
  `Removable when DS …` comment in app source, keep the section here in
  sync so this file remains the single source of truth for the
  DS-integration backlog.

---

## 0. Meta-constraints (the shape of the friction)

Two structural choices in how the app consumes DS drive most of the
workarounds below. They are called out first because every entry after
this should be read through their lens.

### 0.1 No Tailwind build in `messaging-next`

`messaging-next` has **no `tailwind.config.*` and no `postcss.config.*`**.
It imports the pre-compiled `@ogcio/design-system-react/styles.css`
directly (see `src/app/layout.tsx` and `src/app/global-error.tsx`) and
that file is the entire universe of `gi-*` classes available at runtime.

Consequence: the app can only use the **subset** of Tailwind utilities
DS happened to compile for its own internal components. Utilities we'd
reach for intuitively but that were never emitted include:

| Missing utility | Consequence |
|---|---|
| `gi-mt-10`, `gi-mb-16`, `gi-py-12`, `gi-py-20` | Page / loading / empty-state spacing has to live in CSS via `var(--gieds-space-10/12/16/20)` instead of classNames. Forces `main-container.module.css` and the padding in `.loadingState` / `.emptyState` in `unified-inbox-table.module.css`. |
| `gi-text-gray-900` | Shipped only for 500/600/700/800/950. Rules targeting `--gieds-color-gray-900` (`.senderCell`, `.selectAllLabel`) cannot be migrated to utilities without shifting the painted colour. |
| `gi-items-baseline` | `.mobileRowTop` cannot be expressed as utilities; stays as CSS. |
| `gi-space-y-*` | Not emitted at all; vertical rhythm inside wrappers relies on `flex-direction: column + gap`. |

**What this adds up to:** most of the "could be one className" cleanups
the audit in [this commit](…) surfaced were blocked by a missing step in
the compiled bundle, not by the app being sloppy. The fix would be
either (a) giving `messaging-next` its own Tailwind pipeline that emits
`gi-*` classes on demand from the `@ogcio/design-system-tailwind` preset,
or (b) DS shipping a broader / safelisted set in `dist/styles.css`.

### 0.2 Incomplete Tailwind Preflight

DS's bundled `styles.css` contains only the `--tw-content` slice of
Tailwind Preflight. The transform custom properties (`--tw-translate-x`,
`--tw-translate-y`, `--tw-rotate`, `--tw-skew-x/y`, `--tw-scale-x/y`)
are consumed by DS rules (notably `.gi-input-checkbox*:checked::before`
which rotates a corner-shaped pseudo‑element to render the tick) but
are never initialised on `*, ::before, ::after`. With the variables
undefined, the whole `transform` declaration resolves to
`IACVT` ("invalid at computed value time"), is dropped, and every
checked checkbox renders as an L-shaped frame instead of a tick.

**Workaround:** [`src/app/[locale]/styles.css`](src/app/%5Blocale%5D/styles.css) lines 1–39 replay the
Preflight identity defaults so the DS rule resolves to an actual
rotation. `DS gap` comment + `Removable when DS styles.css ships the
full Tailwind Preflight…`

---

## 1. DS bundle bugs we patch

These are not missing features — they are behaviours in the shipped
bundle that are wrong and that the app has to fix at runtime.

| # | Bug | Workaround | Lines |
|---|---|---|---|
| 1.1 | `transform` chain broken (§0.2) | Preflight rescue at root | [`src/app/[locale]/styles.css`](src/app/%5Blocale%5D/styles.css) 1–39 |
| 1.2 | `InputCheckbox` indeterminate state inherits `border-left-width: 4px` from the `:checked` rule and paints an L-shaped dash instead of a flat horizontal bar | `.gi-checkbox-indeterminate:checked::before { border-left-width: 0 }` override on all three sizes | [`src/app/[locale]/styles.css`](src/app/%5Blocale%5D/styles.css) 41–64 |
| 1.3 | DS footer logo `<picture><img>` lacks an `aspect-ratio` and reflows on load | `[data-module="gieds-footer"] picture > img { aspect-ratio: 136 / 48; width: auto }` | [`src/app/[locale]/styles.css`](src/app/%5Blocale%5D/styles.css) 128–131 |

---

## 2. Missing components / component variants

Each row below is something the Figma spec + product requirements
needed, that DS does not expose, and that the app had to reproduce
itself. Every entry has a `Removable when DS …` marker in source — the
rightmost column is that wish restated.

### 2.1 Layout primitives

| # | Gap | How we compensate | Location | What DS needs |
|---|---|---|---|---|
| 2.1.1 | No `Grid` with responsive `cols` + `colSpan` | `.twelve-column-layout` + `.two-thirds-col-span` with four breakpoint blocks (12/8/6/4 cols + `space-8/6/4` gaps) | [`src/app/[locale]/styles.css`](src/app/%5Blocale%5D/styles.css) 66–126 | `Grid` primitive with responsive `cols={{ base, md, sm, xs }}` + `colSpan`. |
| 2.1.2 | `Container` has no `mobileFullBleed` / `gutter='none'` per breakpoint | `.mobileFullBleed { width: 100vw; margin-left: calc(50% - 50vw) }` hack that cancels ancestor gutters at `<768px` | [`src/components/messages/unified-inbox.module.css`](src/components/messages/unified-inbox.module.css) 38–61 | `Container` with `gutter` prop keyed by breakpoint. |
| 2.1.3 | `Container` has no page-gutter margin prop | `.mainContainer { margin-top: var(--gieds-space-10); margin-bottom: var(--gieds-space-16) }` wrapper | [`src/components/layout/main-container.module.css`](src/components/layout/main-container.module.css) 1–9 | `Container` with `spacing` / `padding` / `margin` props, or a page-shell primitive. |
| 2.1.4 | `Stack` (and its descendants) default `min-width: auto` (i.e. intrinsic content), so a wide `InputText` reports a large min-content width that propagates up the flex chain and stretches the list past the `Container` cap | `.listRoot * { min-width: 0 }` — clamp the ENTIRE subtree because the chain is many levels deep | [`src/components/messages/unified-inbox.module.css`](src/components/messages/unified-inbox.module.css) 1–36 | `Stack` with `minWidth` prop, or set `min-width: 0` on its flex children by default. |

### 2.2 Table

`Table` is the component with the most friction — it is used for the
authenticated message list, which is the primary surface of the app.

| # | Gap | How we compensate | Location | What DS needs |
|---|---|---|---|---|
| 2.2.1 | `Table` has no `responsive` / `overflowX='auto'` variant; fixed column widths overflow the `Container` at tablet/narrow-desktop | `.desktopTable { display: block; overflow-x: auto }` wrapper | [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) 16–19 | `Table` with `responsive` / `overflowX` prop, or a mobile/tablet variant. |
| 2.2.2 | `TableRow` has no `onClick` / `clickable` / `as='button'` variant — yet "whole-row click opens the message" is the primary navigation gesture on the list | `.clickableRow` paints cursor + hover tint + focus-visible outline, plus `role='button'` + `tabIndex={0}` on the JSX row | [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) 68–92 | `TableRow` with `onClick` or `as='button'`. |
| 2.2.3 | `TableRow` has no `emphasis` / `variant='unread'` — Figma calls for gray-200 background + weight-700 text on unread rows | Doubled `.unreadRow.unreadRow` selector + descendant selectors targeting `td`, `:global(.gi-table-td)`, `span`, `time`, `button` to beat DS defaults without `!important` | [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) 26–53 | `TableRow` with `emphasis="unread"` / `variant="emphasis"`. |
| 2.2.4 | `Table` has no "attached toolbar" variant, so the bulk-action banner and the table appear as two separately-rounded surfaces with a hairline seam between them | `.containerWithBanner .desktopTable :global(.gi-table) { border-top-*-radius: 0 }` + `.bulkBannerHideDefaultLabel { border-bottom-*-radius: 0 }` | [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) 254–269 + 220–225 | `<Table toolbar={…}>` slot, or `attached` / `flat` prop on one side. |
| 2.2.5 | `Table` adds no horizontal padding to the first cell → Select-All checkbox is flush against the left edge | `.desktopTable :global(table) > thead > tr > th:first-child { padding-left: var(--gieds-space-3); vertical-align: middle }` (+ `td:first-child` equivalent) | [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) 443–450 | `Table` with a `selectable` variant that reserves a leading gutter automatically. |
| 2.2.6 | `Table` / `TableData` have no loading state | `MessageTable` pins a `<TableData colSpan={3} style={{ height }} …>` to the previously-rendered table height and centres a `<Spinner>` | [`src/components/messages/message-table.tsx`](src/components/messages/message-table.tsx) 50–73 | `Table` (or `TableBody`) with `loading` / `skeleton` state. |
| 2.2.7 | `DataTableFooter` renders footer content inside `<td colSpan="999" class="gi-p-2">` — that `<td>` has no `.gi-table-td` class, so DS's `--gieds-font-size-400` root (18px) is inherited instead of the `.gi-table-td` override to `--gieds-font-size-300` (16px). Footer ends up 2px bigger than the body. | Two scoped rules: `.desktopTable :global(tfoot td) { font-size: var(--gieds-font-size-300) }` plus an explicit override on `.gi-table-pagination-label` (desktop + mobile) whose own `font-size-400` beats inheritance | [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) 120–170 | `TablePagination` / `DataTableFooter` with `size` / `density`, or inheriting `.gi-table-td` tokens. |

### 2.3 Form controls

| # | Gap | How we compensate | Location | What DS needs |
|---|---|---|---|---|
| 2.3.1 | `SelectNative` — its `.gi-select-container` defaults to `display: inline; width: 100%`. In a flex slot wider than the `<select>`, the chevron anchors outside the border | Shrink-wrap via `.rowsPerPage :global(.gi-select-container) { display: inline-block; width: auto }` + muted border on the rows-per-page chip | [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) 181–190 | `SelectNative` width-behaviour prop, or a container that shrink-wraps the select by default. |
| 2.3.2 | `InputCheckbox` has no dark-surface variant — on the gray-900 mobile select-mode header, the default neutral border + tick blend into the background and the control reads as missing | `:global(.gi-input-checkbox*)` + `:checked::before` repaint to `--gieds-color-gray-50` scoped under `.mobileSelectHeaderDark` | [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) 332–342 | `InputCheckbox` with `appearance='dark'` / `tone` prop. |
| 2.3.3 | `InputCheckbox` has no `presentation`-only non-focusable variant — the mobile message row is a single `<button>` that toggles the row's selection, so nesting `<input type="checkbox">` inside it is invalid HTML (interactive-in-interactive). | Hand-authored `CheckboxIndicatorIcon` SVG (99 lines) that is a 1:1 port of the DS `InputCheckbox` pseudo-element geometry (frame `rect`, rotated `-45°` polyline for the tick, 12×1 line for indeterminate dash) using `currentColor` so ancestor tone drives both border + glyph | [`src/components/icons/checkbox-indicator.tsx`](src/components/icons/checkbox-indicator.tsx) | `InputCheckbox` with a `presentation` (role, unfocusable) variant, or a stand-alone `CheckboxIndicator` primitive. |

### 2.4 Buttons

| # | Gap | How we compensate | Location | What DS needs |
|---|---|---|---|---|
| 2.4.1 | `Button` has no `ghost` / `appearance='dark'` / `subtle-on-dark` variant — on the gray-900 mobile select-mode header the mandatory Close button reads as a hard chip that competes visually with the primary Delete action next to it | `.mobileCloseButton { border-color: rgba(255,255,255,0.25) !important }` (and bumped to `0.6` on hover/focus-visible). `!important` is the **only `!important` in the entire app** and is required to beat `.gi-btn-secondary-light`'s border-color at equal specificity | [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) 395–410 | `Button` with `appearance='dark'` / `ghost` / `subtle-on-dark`. |

### 2.5 Toast

| # | Gap | How we compensate | Location | What DS needs |
|---|---|---|---|---|
| 2.5.1 | `ToastProvider` accepts a single `ToastPosition` and never re-evaluates it. On mobile a desktop-side `top-right` toast lands partly off-screen | Portal-level overrides: bump `z-index` above the search bar, and at `<767px` remap `top-right` → full-width centred using `left: 50%; transform: translateX(-50%); max-width: calc(100% - space-4)` | [`src/app/[locale]/styles.css`](src/app/%5Blocale%5D/styles.css) 156–193 | `ToastProvider` with responsive `position={{ base: 'top-center', md: 'top-right' }}` (mirror of `Stack.direction`). |

### 2.6 Icons

| # | Gap | How we compensate | Location | What DS needs |
|---|---|---|---|---|
| 2.6.1 | DS inline-SVG atom icons cover `close`, `visibility`, `chevron_*`, `first_page`, etc. but **not** `search`. For `icon="search"`, DS falls back to the Material Symbols web font. When the icon renders inside `InputText.inputActionButton` (hard-coded `size: "small"` → 16px), the Material Symbols variable font's `opsz` axis is clamped below its valid 20–48 range and the glyph renders hair-thin and too small to read. | Hand-authored `SearchIcon` component (52 lines): a 1:1 port of the Material Symbols Outlined `search` glyph at `wght=400` into DS's atom shape (`viewBox="0 -960 960 960"`, `fill="currentColor"`). Routed through `InputText`'s `iconEnd` slot instead of `inputActionButton` to avoid the size-small clamp | [`src/components/icons/search.tsx`](src/components/icons/search.tsx) + call site in [`unified-inbox-table.tsx`](src/components/messages/unified-inbox-table.tsx) around line 310 | DS inline-SVG `Search` atom in `atoms/icons/`, next to `Close`, `Visibility`, etc. |

### 2.7 i18n

| # | Gap | How we compensate | Location | What DS needs |
|---|---|---|---|---|
| 2.7.1 | DS bundles `react-i18next` as its own i18n runtime. `DataTableSelectedRowsBanner`'s label is read from `dataTable.selectedRows` with an English `(N Rows selected)` fallback. `messaging-next` uses `next-intl` and does not bootstrap the DS i18next instance — so the built-in label can never be translated by the app, period. | `BulkActionToolbar` wrapper: renders `DataTableSelectedRowsBanner` with its own `actions` slot carrying the `next-intl`-translated copy + Delete button. `.bulkBannerHideDefaultLabel` CSS hides the DS-owned label, flattens the bottom corners (for the attached toolbar, §2.2.4) and re-flexes the `actions` div with `space-between` + `items-center` so the hidden-label-left / actions-right layout survives | [`src/components/messages/bulk-action-toolbar.tsx`](src/components/messages/bulk-action-toolbar.tsx) + [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) 193–233 | Either (a) DS components accept a `label` prop instead of resolving it themselves, or (b) DS exposes a render-prop / slot for every built-in string, so the app can pipe its own i18n through. |

---

## 3. Token gaps

Design tokens that Figma specifies but DS does not expose as a
consumer-ready shortcut.

| Intent | Target | Why CSS | Affected rules |
|---|---|---|---|
| "In-between" text size | 15px / `0.9375rem` (between `--gieds-font-size-200` = 14 and `-300` = 16) | DS has no 15px token and no `gi-text-*` utility in that bracket | `.unreadCount`, `.unreadCountDesktop`, `.mobileDate`, `.bulkBannerCount`, `.mobileSelectedCount` in [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) |
| Gray-900 text on light surface | `var(--gieds-color-gray-900)` | DS ships `gi-text-gray-{500,600,700,800,950}` only — 900 is absent | `.senderCell`, `.selectAllLabel` in [`unified-inbox-table.module.css`](src/components/messages/unified-inbox-table.module.css) |
| Flex baseline alignment | `align-items: baseline` | No `gi-items-baseline` in the bundle | `.mobileRowTop` |
| Larger vertical padding | `padding: var(--gieds-space-{12,20}) …` | No `gi-py-12` / `gi-py-20` in the bundle | `.loadingState`, `.emptyState` |
| Large page margins | `margin-top: space-10; margin-bottom: space-16` | No `gi-mt-10` / `gi-mb-16` in the bundle | `.mainContainer` |

---

## 4. Friction signals: `!important` and `:global(.gi-*)` tallies

Two mechanical proxies for how often the app has to reach past DS's
public API. Both are kept deliberately tiny — new entries should always
come with a `DS gap:` comment explaining why the public prop wasn't
enough, plus a `Removable when DS …` note.

### 4.1 `!important` uses (entire app — 2 occurrences, all the same rule)

```422:429:apps/messaging-next/src/components/messages/unified-inbox-table.module.css
.mobileCloseButton {
  border-color: rgba(255, 255, 255, 0.25) !important;
}

.mobileCloseButton:hover:not(:disabled),
.mobileCloseButton:focus-visible {
  border-color: rgba(255, 255, 255, 0.6) !important;
}
```

Both tied to §2.4.1. The app has no other `!important` anywhere — the
file-audit grep is trivial: `rg '!important' apps/messaging-next/src`.

### 4.2 `:global(.gi-*)` overrides (13 selectors, all in one file)

All targeting DS internals. Each has a `DS gap:` comment with the
reason and a `Removable when …` pointer.

| DS internal class | Why we reach into it | Lines |
|---|---|---|
| `.gi-table-head` | unread-row header background | 78 |
| `.gi-table-td` | unread-row bold-weight override | 99 |
| `.gi-table` | attached-toolbar flat top corners | 315 |
| `.gi-table-pagination` | centre pagination on mobile | 156 |
| `.gi-table-pagination-label` | fix footer font-size (§2.2.7) | 212–213 |
| `.gi-select` | pin rows-per-page width (§2.3.1) | 172 |
| `.gi-select-icon` | single-translate chevron fix | 166 |
| `.gi-select-container` | shrink-wrap container (§2.3.1) | 230 |
| `.gi-input-checkbox{,-small,-medium}` | dark-surface border (§2.3.2) | 393–395 |
| `.gi-input-checkbox…:checked::before` | dark-surface tick colour (§2.3.2) | 399–401 |

---

## 5. Custom components built to compensate

Components the app had to author because DS does not ship an equivalent.
Keeping them visible here so future contributors know they are DS-gap
shims, not organic app code to expand on.

| Component | Purpose | Size | Removable when |
|---|---|---|---|
| [`SearchIcon`](src/components/icons/search.tsx) | §2.6.1 — inline-SVG `search` atom | 52 lines | DS ships `atoms/icons/Search` |
| [`CheckboxIndicatorIcon`](src/components/icons/checkbox-indicator.tsx) | §2.3.3 — decorative checkbox safe inside `<button>` | 99 lines | DS ships a `presentation`-only `InputCheckbox` variant |
| [`BulkActionToolbar`](src/components/messages/bulk-action-toolbar.tsx) | §2.7.1 — `DataTableSelectedRowsBanner` with next-intl label routed through `actions` | 69 lines | DS components take an explicit `label` prop (or render slot) instead of using `react-i18next` internally |
| [`MainContainer`](src/components/layout/containers.tsx) | §2.1.3 — page-gutter margin wrapper | 6 lines + 9 lines of CSS | `Container` has a `spacing` / `padding` prop |

Plus the CSS-only "ghost components":

- `.twelve-column-layout` + `.two-thirds-col-span` (§2.1.1)
- `.mobileFullBleed` (§2.1.2)
- `.listRoot` (§2.1.4)
- `.clickableRow`, `.mobileRow` (§2.2.2 — repeated once per viewport)
- `.unreadRow` + descendant selectors (§2.2.3)
- `.mobileSelectHeader{,Dark}`, `.mobileSelectActions`, `.mobileCloseButton`, `.bulkBannerHideDefaultLabel`, `.bulkBannerCount` — chrome around the mobile/desktop bulk-selection flow that DS does not package as a unit.

---

## 6. Cost tally

What DS-gap workaround work adds up to, right now, in this app.

| Kind | Count |
|---|---|
| CSS files that exist only because of DS gaps | 5 (`styles.css`, `font-override.css`, `main-container.module.css`, `unified-inbox.module.css`, `unified-inbox-table.module.css`) |
| Total lines in those files | **~902** |
| …of which in `unified-inbox-table.module.css` alone | 635 |
| Custom shim components (SVG icons + wrappers) | 4 (226 lines) |
| `DS gap:` markers in source | 22 |
| `Removable when DS …` upstream wishes | 16 |
| `!important` uses | 2 (both for one DS-gap rule) |
| `:global(.gi-*)` overrides of DS internals | 13 selectors |
| Inline `style={{…}}` hotspots for values DS has no utility for | 6 sites (minHeight viewport units, overflowWrap, dynamic height) |

---

## 7. Consolidated "Removable when DS ships …" wishlist

One-line rollup. Pair each item with its section above for context and
the exact diff it would unlock.

1. Full Tailwind Preflight in `dist/styles.css` — or initialise the
   transform custom properties alongside the rules that consume them.
   (§0.2, §1.1)
2. `border-left-width: 0` on `.gi-checkbox-indeterminate:checked::before`
   — or rewrite the dash as a standalone shape. (§1.2)
3. `aspect-ratio` on the footer logo `<img>`. (§1.3)
4. `Grid` primitive with responsive `cols` + `colSpan`. (§2.1.1)
5. `Container` with `gutter='none'` / `mobileFullBleed` per breakpoint.
   (§2.1.2)
6. `Container` / page-shell with `spacing` / `padding` / `margin`
   props. (§2.1.3)
7. `Stack` (and flex-row children) default to `min-width: 0`, or expose
   a `minWidth` prop. (§2.1.4)
8. `Table` with `responsive` / `overflowX='auto'`. (§2.2.1)
9. `TableRow` with `onClick` / `clickable` / `as='button'`. (§2.2.2)
10. `TableRow` with `emphasis` / `variant='unread'`. (§2.2.3)
11. `<Table toolbar={…}>` slot, or `attached` / `flat` prop on
    `DataTableSelectedRowsBanner` / `Table`. (§2.2.4)
12. `Table` selectable variant that reserves a leading gutter. (§2.2.5)
13. `Table` / `TableBody` with `loading` / `skeleton` state. (§2.2.6)
14. `TablePagination` / `DataTableFooter` with `size` / `density`, or
    footer content that inherits `.gi-table-td` tokens. (§2.2.7)
15. `SelectNative` that shrink-wraps its container by default — or a
    `width='auto'` prop. (§2.3.1)
16. `InputCheckbox` with `appearance='dark'` / `tone` prop. (§2.3.2)
17. `InputCheckbox` with `presentation` (non-focusable) variant, or a
    stand-alone `CheckboxIndicator` primitive. (§2.3.3)
18. `Button` with `appearance='dark'` / `ghost` / `subtle-on-dark`.
    (§2.4.1)
19. `ToastProvider` with responsive `position` (object keyed by
    breakpoint, mirror of `Stack.direction`). (§2.5.1)
20. Inline-SVG `Search` atom in `atoms/icons/`. (§2.6.1)
21. DS components accept an explicit `label` prop (or render slot) for
    every built-in string, rather than resolving them via an internal
    `react-i18next` instance the consumer cannot configure. (§2.7.1)
22. Broader / safelisted `gi-*` utility emission in `dist/styles.css`,
    or a documented way for apps to run their own Tailwind build on
    top of the preset. Would unlock every item in §3. (§0.1)

---

## 8. How to use this document

- **When debugging a DS-adjacent style bug:** search this file first
  for the component name. If it's listed, the workaround is documented
  and the file/lines in the right-hand columns are the source of truth.
- **When adding a new DS gap:** add a `DS gap:` comment in source with
  a `Removable when DS …` marker, then add a row in the matching
  section here. Keep this file and the code in sync — otherwise we
  lose the ability to sweep workarounds when DS catches up.
- **When DS releases a new version:** walk the `Removable when DS …`
  list in §7, grep source for the corresponding comment, and if DS
  now ships the feature, delete both the CSS rule and the row here
  in the same commit.
