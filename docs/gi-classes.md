# `gi-*` class reference

A lookup table for the CSS classes shipped by the Government of Ireland
design system. This file lists every class baked into the compiled
stylesheet of the `@ogcio/design-system-react` version currently pinned
in the repo, grouped by component / utility family.

This is a name-level reference only. For semantics, variants, component
APIs, accessibility notes, and interactive examples, open the upstream
Storybooks / docs site described in the links below.

## Source of truth

- Package: `@ogcio/design-system-react@1.34.0`
- Compiled stylesheet inspected: `apps/messaging-next/node_modules/@ogcio/design-system-react/dist/styles.css`
- Upstream monorepo: [ogcio/govie-ds](https://github.com/ogcio/govie-ds)
- Upstream Tailwind preset (where the `gi-*` prefix is defined): [packages/design/tailwind/README.md](https://github.com/ogcio/govie-ds/blob/main/packages/design/tailwind/README.md)
- Architecture overview: [docs/overview.md](https://github.com/ogcio/govie-ds/blob/main/docs/overview.md)

The `gi-` prefix stands for "Government of Ireland" and is applied by
`@ogcio/design-system-tailwind` (the Tailwind preset used to build the
design system). `@ogcio/design-system-react` components render markup
that applies these classes and ships the compiled output in
`dist/styles.css`, so this list represents exactly the class names that
will be present in the DOM at runtime for an app pinned to 1.34.0.

For interactive component documentation, run the upstream Storybooks:

```bash
git clone https://github.com/ogcio/govie-ds
cd govie-ds
corepack enable && pnpm install
pnpm storybook:react
pnpm storybook:html
pnpm docs
```

## Regenerating this file

When the pinned version of `@ogcio/design-system-react` changes, run:

```bash
grep -oE '\.gi-[a-zA-Z0-9_-]+' \
  apps/messaging-next/node_modules/@ogcio/design-system-react/dist/styles.css \
  | sort -u
```

A few entries in this file end with a trailing hyphen (e.g. `gi-p-`,
`gi-w-`, `gi-z-`, `gi-translate-x-`). Those are the class-name prefixes
of Tailwind's arbitrary-value utilities (e.g. `gi-z-[10]`,
`gi-w-[32rem]`) — the regex above stops at the opening `[`, so only the
prefix makes it into the list. They are not directly usable by
themselves; they're shown here because the compiled CSS does contain
those fragments.

## Summary

- **Total unique `gi-*` classes:** 1040
- **Prefix families:** 113 (first segment after `gi-`)
- **Component classes** (`gi-btn`, `gi-table`, `gi-modal`, …): ~275
- **Semantic color-token utilities** (`gi-bg-color-*`, `gi-text-color-*`, `gi-border-color-*`, `gi-stroke-color-*`, `gi-fill-color-*`): 87
- **Focus-ring helpers** (`gi-focus-state-*`, `gi-focus-visible-state-*`, `gi-focus-within-state-*`): 13
- **Scale utilities** (spacing, sizing, grid, layout, typography scales): the remainder

### Top prefixes by count

| Prefix     | Count | Prefix     | Count | Prefix     | Count |
| ---------- | ----: | ---------- | ----: | ---------- | ----: |
| `gap`      | 177   | `bg`       | 34    | `side`     | 11    |
| `text`     | 54    | `border`   | 32    | `tag`      | 10    |
| (negative) | 52    | `input`    | 30    | `layout`   | 10    |
| `col`      | 42    | `table`    | 25    | `alert`    | 10    |
| `row`      | 42    | `btn`      | 23    | `link`     | 9     |
| `grid`     | 38    | `header`   | 23    | `justify`  | 9     |
| `stroke`   | 21    | `modal`    | 13    | `progress` | 8     |
| `toast`    | 16    | `focus`    | 13    | `align`    | 8     |
| `card`     | 16    | `flex`     | 14    | `select`   | 12    |
| `w`        | 15    | `combobox` | 12    | `tab`      | 7     |

The "(negative)" row is Tailwind's negative-value utilities, e.g.
`gi--col-end-3`, `gi--row-start-5`.

## Component classes

Per-component listings of every class in `dist/styles.css`. Use these
directly in a `.module.css` via
`composes: gi-<class> from global;` or on a DOM node's `className` when
composing DS chrome with app-level styles.

### `gi-accordion`

```text
.gi-accordion
.gi-accordion-header
.gi-accordion-item-container
.gi-accordion-item-icon
.gi-accordion-item-slot
```

### `gi-alert`

```text
.gi-alert-base
.gi-alert-base-dismissible
.gi-alert-container
.gi-alert-danger
.gi-alert-dismiss
.gi-alert-icon
.gi-alert-info
.gi-alert-success
.gi-alert-title
.gi-alert-warning
```

### `gi-blockquote`

```text
.gi-blockquote
```

### `gi-breadcrumbs`

```text
.gi-breadcrumbs
.gi-breadcrumbs-link
.gi-breadcrumbs-separator
```

### `gi-btn`

```text
.gi-btn
.gi-btn-flat
.gi-btn-flat-dark
.gi-btn-flat-dark-disabled
.gi-btn-flat-disabled
.gi-btn-flat-light
.gi-btn-flat-light-disabled
.gi-btn-group
.gi-btn-large
.gi-btn-primary
.gi-btn-primary-dark
.gi-btn-primary-dark-disabled
.gi-btn-primary-disabled
.gi-btn-primary-light
.gi-btn-primary-light-disabled
.gi-btn-regular
.gi-btn-secondary
.gi-btn-secondary-dark
.gi-btn-secondary-dark-disabled
.gi-btn-secondary-disabled
.gi-btn-secondary-light
.gi-btn-secondary-light-disabled
.gi-btn-small
```

### `gi-card`

```text
.gi-card
.gi-card-action
.gi-card-content
.gi-card-header
.gi-card-heading
.gi-card-horizontal
.gi-card-icon
.gi-card-iframe
.gi-card-image
.gi-card-inset-body
.gi-card-paragraph
.gi-card-subheading
.gi-card-tag
.gi-card-title
.gi-card-truncate-text
.gi-card-vertical
```

### `gi-checkbox` / `gi-chip`

```text
.gi-checkbox-indeterminate
.gi-chip
```

### `gi-combobox`

```text
.gi-combobox-checkbox
.gi-combobox-checkbox-container
.gi-combobox-checkbox-paragraph
.gi-combobox-container
.gi-combobox-dropdown-container-close
.gi-combobox-dropdown-container-open
.gi-combobox-dropdown-item
.gi-combobox-search
.gi-combobox-search-icon
.gi-combobox-search-input
.gi-combobox-toggle
.gi-combobox-toggle-content
```

### `gi-cookie` / `gi-drawer` / `gi-phase`

```text
.gi-cookie-banner-buttons
.gi-cookie-banner-container
.gi-drawer-body
.gi-drawer-container
.gi-phase-banner-container
.gi-phase-banner-content
```

### `gi-details`

```text
.gi-details
.gi-details-summary
.gi-details-summary-text
.gi-details-text
```

### `gi-error`

```text
.gi-error-state
.gi-error-text
.gi-error-text-lg
.gi-error-text-md
.gi-error-text-sm
```

### `gi-footer`

```text
.gi-footer
.gi-footer-container
.gi-footer-logo
.gi-footer-secondary-slot
.gi-footer-secondary-slot-content
.gi-footer-utility
```

### `gi-header`

```text
.gi-header
.gi-header-accordion-item-toggle
.gi-header-divider
.gi-header-logo
.gi-header-logo-default
.gi-header-logo-light
.gi-header-menu
.gi-header-menu-container
.gi-header-menu-mobile-trigger
.gi-header-mobile-menu-trigger
.gi-header-nav
.gi-header-overlay
.gi-header-primary-menu
.gi-header-secondary-bar
.gi-header-secondary-item
.gi-header-secondary-item-default
.gi-header-secondary-item-light
.gi-header-slot-container
.gi-header-title
.gi-header-tool-item
.gi-header-tool-item-default
.gi-header-tool-item-input
.gi-header-tool-item-light
```

### `gi-heading`

```text
.gi-heading-2xs
.gi-heading-xs
.gi-heading-sm
.gi-heading-md
.gi-heading-lg
.gi-heading-xl
```

### `gi-hint`

```text
.gi-hint-text
.gi-hint-text-lg
.gi-hint-text-md
.gi-hint-text-sm
```

### `gi-icon`

```text
.gi-icon-btn-small
.gi-icon-btn-regular
.gi-icon-btn-large
.gi-icon-btn-extra-large
```

### `gi-input`

```text
.gi-input-checkbox
.gi-input-checkbox-container
.gi-input-checkbox-hint-container
.gi-input-checkbox-large
.gi-input-checkbox-medium
.gi-input-checkbox-small
.gi-input-disabled-state
.gi-input-file
.gi-input-group-container
.gi-input-group-error
.gi-input-group-options-container
.gi-input-group-options-inline
.gi-input-group-options-stacked
.gi-input-half-width
.gi-input-radio-base
.gi-input-radio-conditional-divider-border
.gi-input-radio-conditional-divider-border-container
.gi-input-radio-conditional-divider-container
.gi-input-radio-container
.gi-input-radio-medium
.gi-input-radio-small
.gi-input-text
.gi-input-text-action-before-suffix
.gi-input-text-container
.gi-input-text-end-element
.gi-input-text-icon-end
.gi-input-text-icon-start
.gi-input-text-inner
.gi-input-text-prefix
.gi-input-text-suffix
```

### `gi-label` / `gi-popover`

```text
.gi-label
.gi-popover
```

### `gi-layout`

```text
.gi-layout-column-1-2
.gi-layout-column-1-3
.gi-layout-column-2-3
.gi-layout-container
.gi-layout-container-2-column
.gi-layout-container-3-column
.gi-layout-container-full-width
.gi-layout-container-inset
.gi-layout-container-max-lg
.gi-layout-container-max-xl
```

### `gi-link`

```text
.gi-link
.gi-link-disabled
.gi-link-icon
.gi-link-icon-end
.gi-link-icon-start
.gi-link-inherit
.gi-link-light
.gi-link-no-underline
.gi-link-no-visited
```

### `gi-modal`

```text
.gi-modal
.gi-modal-body
.gi-modal-close
.gi-modal-container
.gi-modal-container-bottom
.gi-modal-container-center
.gi-modal-container-control
.gi-modal-container-left
.gi-modal-container-open
.gi-modal-container-right
.gi-modal-footer
.gi-modal-footer-stacked
.gi-modal-open
```

### `gi-pagination`

```text
.gi-pagination
.gi-pagination-prev-btn
.gi-pagination-next-btn
```

### `gi-paragraph`

```text
.gi-paragraph-xs
.gi-paragraph-sm
.gi-paragraph-md
.gi-paragraph-lg
.gi-paragraph-xl
```

### `gi-progress`

```text
.gi-progress-bar
.gi-progress-bar-container
.gi-progress-bar-indeterminate
.gi-progress-stepper
.gi-progress-stepper-step
.gi-progress-stepper-step-connector
.gi-progress-stepper-step-container
.gi-progress-stepper-step-label
```

### `gi-score` (NPS / score selector)

```text
.gi-score-select-button-group
.gi-score-select-button-group-horizontal
.gi-score-select-button-group-vertical
.gi-score-select-labels
.gi-score-select-labels-responsive
.gi-score-select-labels-vertical
```

### `gi-section`

```text
.gi-section-break-sm
.gi-section-break-md
.gi-section-break-lg
.gi-section-break-xl
```

### `gi-select`

```text
.gi-select
.gi-select-container
.gi-select-icon
.gi-select-menu-container
.gi-select-menu-input-container
.gi-select-menu-loading
.gi-select-menu-option-container
.gi-select-menu-option-not-found
.gi-select-next
.gi-select-option-item
.gi-select-option-item-disabled
.gi-select-option-item-highlighted
```

### `gi-side-nav`

```text
.gi-side-nav-container
.gi-side-nav-expandable-icon
.gi-side-nav-heading
.gi-side-nav-item
.gi-side-nav-item-content
.gi-side-nav-item-icon
.gi-side-nav-item-label
.gi-side-nav-item-left
.gi-side-nav-item-primary
.gi-side-nav-item-secondary
.gi-side-nav-item-selected
```

### `gi-summary`

```text
.gi-summary-list
.gi-summary-list-action
```

### `gi-tab` / `gi-tabs`

```text
.gi-tabs
.gi-tab-list
.gi-tab-list-stretch
.gi-tab-item
.gi-tab-item-border
.gi-tab-item-checked
.gi-tab-panel
.gi-tab-indicator
```

### `gi-table`

```text
.gi-table
.gi-table-auto
.gi-table-caption-text
.gi-table-data-cell
.gi-table-data-slot-container
.gi-table-expand-icon-container
.gi-table-fixed
.gi-table-loading
.gi-table-no-border
.gi-table-no-data
.gi-table-pagination
.gi-table-pagination-label
.gi-table-row-group
.gi-table-td
.gi-table-td-fluid
.gi-table-td-lg-flex
.gi-table-td-md-fixed
.gi-table-td-sm-fixed
.gi-table-td-xs-fixed
.gi-table-th
.gi-table-th-fluid
.gi-table-th-lg-flex
.gi-table-th-md-fixed
.gi-table-th-sm-fixed
.gi-table-th-xs-fixed
```

### `gi-tag`

```text
.gi-tag
.gi-tag-default
.gi-tag-info
.gi-tag-success
.gi-tag-warning
.gi-tag-error
.gi-tag-counter
.gi-tag-counter-warning
.gi-tag-size-default
.gi-tag-size-small
```

### `gi-textarea`

```text
.gi-textarea
.gi-textarea-container
.gi-textarea-error
.gi-textarea-inner
.gi-textarea-remaining-chars
```

### `gi-toast`

```text
.gi-toast
.gi-toast-action
.gi-toast-base
.gi-toast-base-dismissible
.gi-toast-container
.gi-toast-danger
.gi-toast-disappear
.gi-toast-dismiss
.gi-toast-icon
.gi-toast-info
.gi-toast-message
.gi-toast-portal
.gi-toast-success
.gi-toast-title
.gi-toast-warning
.gi-toast-wrapper
```

### `gi-tooltip`

```text
.gi-tooltip
.gi-tooltip-wrapper
.gi-tooltip-top
.gi-tooltip-right
.gi-tooltip-bottom
.gi-tooltip-left
```

## Semantic color-token utilities

These classes bind Tailwind color properties to the design system's
semantic tokens. They follow the shape:

```text
gi-<prop>-color-<slot>-<role>-<variant>-<state>
```

- **prop** — `bg`, `text`, `border`, `border-b`, `fill`, `stroke`
- **slot** — `surface`, `border`, `text`, `icon`
- **role** — `intent-{success|info|warning|error}`,
  `system-{primary|neutral}`,
  `tone-{dark|light|primary}-{fill|flat|outline|accent}`
- **state** — `default`, `subtle`, `muted`, `disabled`, `selected`,
  `layer1` / `layer2` / `layer11`, `interactive-default|muted`

Prefer these over raw `gi-{bg,text,…}-gray-*` / `gi-{bg,text,…}-black`
/ `gi-{bg,text,…}-white` utilities anywhere the element has semantic
meaning — they automatically pick up theme overrides (e.g. the
`@ogcio/theme-govie` vs. `@ogcio/theme-doete` vs. `@ogcio/theme-hse`
theme packages) without code changes.

<details>
<summary>All 87 semantic color-token classes</summary>

```text
.gi-bg-color-border-system-neutral-interactive-default
.gi-bg-color-border-tone-primary-accent-selected
.gi-bg-color-surface-intent-error-default
.gi-bg-color-surface-intent-info-default
.gi-bg-color-surface-intent-success-default
.gi-bg-color-surface-intent-warning-default
.gi-bg-color-surface-system-neutral-layer1
.gi-bg-color-surface-system-neutral-layer11
.gi-bg-color-surface-system-neutral-layer2
.gi-bg-color-surface-system-primary-default
.gi-bg-color-surface-system-primary-subtle
.gi-bg-color-surface-tone-dark-fill-default
.gi-bg-color-surface-tone-dark-fill-disabled
.gi-bg-color-surface-tone-dark-flat-disabled
.gi-bg-color-surface-tone-dark-outline-default
.gi-bg-color-surface-tone-light-fill-default
.gi-bg-color-surface-tone-light-fill-disabled
.gi-bg-color-surface-tone-light-flat-default
.gi-bg-color-surface-tone-light-flat-disabled
.gi-bg-color-surface-tone-light-outline-disabled
.gi-bg-color-surface-tone-primary-fill-default
.gi-bg-color-surface-tone-primary-fill-disabled
.gi-bg-color-surface-tone-primary-flat-disabled
.gi-bg-color-surface-tone-primary-outline-disabled
.gi-bg-color-text-system-neutral-interactive-default
.gi-border-color-border-intent-error-subtle
.gi-border-color-border-intent-info-subtle
.gi-border-color-border-intent-success-subtle
.gi-border-color-border-intent-warning-subtle
.gi-border-color-border-system-neutral-muted
.gi-border-color-border-system-neutral-subtle
.gi-border-color-border-tone-dark-outline-default
.gi-border-color-border-tone-dark-outline-disabled
.gi-border-color-border-tone-light-outline-default
.gi-border-color-border-tone-light-outline-disabled
.gi-border-color-border-tone-primary-outline-default
.gi-border-color-border-tone-primary-outline-disabled
.gi-border-b-color-surface-system-primary-default
.gi-fill-color-text-system-neutral-interactive-default
.gi-fill-color-text-system-neutral-interactive-muted
.gi-stroke-color-text-system-neutral-muted
.gi-stroke-color-text-tone-dark-fill-default
.gi-stroke-color-text-tone-dark-fill-disabled
.gi-stroke-color-text-tone-dark-flat-default
.gi-stroke-color-text-tone-dark-flat-disabled
.gi-stroke-color-text-tone-dark-outline-disabled
.gi-stroke-color-text-tone-light-fill-default
.gi-stroke-color-text-tone-light-fill-disabled
.gi-stroke-color-text-tone-light-flat-default
.gi-stroke-color-text-tone-light-flat-disabled
.gi-stroke-color-text-tone-light-outline-default
.gi-stroke-color-text-tone-light-outline-disabled
.gi-stroke-color-text-tone-primary-fill-default
.gi-stroke-color-text-tone-primary-fill-disabled
.gi-stroke-color-text-tone-primary-flat-default
.gi-stroke-color-text-tone-primary-flat-disabled
.gi-stroke-color-text-tone-primary-outline-default
.gi-stroke-color-text-tone-primary-outline-disabled
.gi-text-color-icon-intent-error-default
.gi-text-color-icon-intent-info-default
.gi-text-color-icon-intent-success-default
.gi-text-color-icon-intent-warning-default
.gi-text-color-text-intent-error-default
.gi-text-color-text-intent-info-default
.gi-text-color-text-intent-success-default
.gi-text-color-text-intent-warning-default
.gi-text-color-text-system-neutral-default
.gi-text-color-text-system-neutral-interactive-default
.gi-text-color-text-system-neutral-interactive-muted
.gi-text-color-text-system-neutral-muted
.gi-text-color-text-tone-dark-fill-default
.gi-text-color-text-tone-dark-fill-disabled
.gi-text-color-text-tone-dark-flat-default
.gi-text-color-text-tone-dark-flat-disabled
.gi-text-color-text-tone-dark-outline-disabled
.gi-text-color-text-tone-light-default
.gi-text-color-text-tone-light-fill-default
.gi-text-color-text-tone-light-fill-disabled
.gi-text-color-text-tone-light-flat-default
.gi-text-color-text-tone-light-flat-disabled
.gi-text-color-text-tone-light-outline-default
.gi-text-color-text-tone-light-outline-disabled
.gi-text-color-text-tone-primary-fill-default
.gi-text-color-text-tone-primary-fill-disabled
.gi-text-color-text-tone-primary-flat-default
.gi-text-color-text-tone-primary-flat-disabled
.gi-text-color-text-tone-primary-outline-default
.gi-text-color-text-tone-primary-outline-disabled
```

</details>

## Focus-ring helpers

The design system ships three focus-ring families, keyed on which CSS
pseudo-class they trigger on:

- `gi-focus-state-*` — triggers on `:focus` (keyboard + mouse, so the
  ring shows while an element is clicked). Use when you want the ring
  visible during every interaction.
- `gi-focus-visible-state-*` — triggers on `:focus-visible` (keyboard
  / assistive tech only). Use for clickable surfaces where a persistent
  outline on mouse click would be noisy. This is usually the right
  choice for rows, cards, and other large hit targets.
- `gi-focus-within-state-*` — triggers on `:focus-within` (an
  ancestor gets the ring when any descendant is focused). Use for
  composite controls (input + icon, combo buttons, etc.).

All rings are painted with the design system's semantic focus tokens
(`--gieds-color-shadow-intent-focus-default` for outlines,
`--gieds-color-border-intent-focus-default` for borders), so they
automatically adapt to theme overrides.

| Class | Trigger | Effect |
| ----- | ------- | ------ |
| `.gi-focus-state-outline` | `:focus` | 3px solid outline, offset 0, `--gieds-color-shadow-intent-focus-default` |
| `.gi-focus-state-outline-header` | `:focus` | 2px solid outline, offset 0, focus token (sized for header chrome) |
| `.gi-focus-state-outline-inner-shadow-sm` | `:focus` | 3px outline + inset 2px box-shadow + `--gieds-color-gray-200` background + `--gieds-border-radius-100` |
| `.gi-focus-state-border` | `:focus` | `--gieds-border-width-300` solid border in `--gieds-color-border-intent-focus-default` |
| `.gi-focus-state-border-sm` | `:focus` | `--gieds-border-width-200` solid border in focus token |
| `.gi-focus-state-border-sm-rounded` | `:focus` | Same as `-sm` plus `--gieds-border-radius-100` |
| `.gi-focus-visible-state-outline` | `:focus-visible` | 3px solid outline, focus token |
| `.gi-focus-visible-state-outline-inner-shadow-sm` | `:focus-visible` | 3px outline + inset shadow + gray-200 surface |
| `.gi-focus-visible-state-border` | `:focus-visible` | border-width-300, focus token |
| `.gi-focus-visible-state-border-sm` | `:focus-visible` | border-width-200, focus token |
| `.gi-focus-visible-state-border-sm-rounded` | `:focus-visible` | border-width-200, focus token, border-radius-100 |
| `.gi-focus-within-state-outline` | `:focus-within` | 3px solid outline, focus token |
| `.gi-focus-within-state-outline-header` | `:focus-within` | 2px solid outline, focus token |

## Scale utilities

The remaining ~500 classes are Tailwind-style utilities with the `gi-`
prefix applied. They follow Tailwind's naming conventions, wired to the
design system's token scale instead of the default Tailwind scale. The
families, at a glance:

- Spacing: `gi-gap-*`, `gi-gap-x-*`, `gi-gap-y-*`, `gi-space-x-*`,
  `gi-space-y-*`, `gi-p-*`, `gi-px-*`, `gi-py-*`, `gi-pt-*`,
  `gi-pr-*`, `gi-pb-*`, `gi-pl-*`, `gi-m-*`, `gi-mx-*`, `gi-my-*`,
  `gi-mt-*`, `gi-mr-*`, `gi-mb-*`, `gi-ml-*` (with negative siblings,
  e.g. `gi--mt-2` on some values).
- Sizing: `gi-w-*`, `gi-h-*`, `gi-min-w-*`, `gi-min-h-*`,
  `gi-max-w-*`, `gi-max-h-*`, `gi-basis-*`.
- Grid / flex: `gi-grid`, `gi-grid-cols-*`, `gi-grid-rows-*`,
  `gi-grid-flow-*`, `gi-col-span-*`, `gi-col-start-*`, `gi-col-end-*`,
  `gi-row-span-*`, `gi-row-start-*`, `gi-row-end-*` (with negative
  `gi--col-*` / `gi--row-*`), `gi-flex`, `gi-flex-*`, `gi-items-*`,
  `gi-justify-*`, `gi-align-*`, `gi-order-*`, `gi-grow-*`,
  `gi-shrink-*`, `gi-span-*`.
- Position / display: `gi-absolute`, `gi-relative`, `gi-block`,
  `gi-inline`, `gi-inline-block`, `gi-inline-flex`, `gi-hidden`,
  `gi-invisible`, `gi-sr-only`, `gi-top-*`, `gi-right-*`,
  `gi-bottom-*`, `gi-left-*`, `gi-z-*`.
- Overflow / whitespace / truncation: `gi-overflow-*`,
  `gi-overflow-x-*`, `gi-overflow-y-*`, `gi-whitespace-*`,
  `gi-truncate`, `gi-text-ellipsis`, `gi-line-clamp-*`.
- Typography: `gi-text-*` (align, size), `gi-font-*`, `gi-leading-*`,
  `gi-decoration-*`, `gi-underline`, `gi-no-underline`, `gi-list-*`.
- Visual effects: `gi-rounded*`, `gi-opacity-*`, `gi-transition*`,
  `gi-duration-*`, `gi-rotate-*`, `gi-translate-*`, `gi-cursor-*`,
  `gi-pointer-events-*`, `gi-snap-*`, `gi-group`.
- Plain-palette color utilities: `gi-bg-{black,white,gray-*,transparent}`,
  `gi-text-{black,white,gray-*,brand-neutral-*}`,
  `gi-border-{white,transparent,gray-*}`, `gi-fill-gray-*`,
  `gi-stroke-{white,gray-*}`. Prefer the semantic color-token
  utilities above when the element has a semantic role.

See the Tailwind preset's source in
[packages/design/tailwind/src](https://github.com/ogcio/govie-ds/tree/main/packages/design/tailwind/src)
for the authoritative list of supported scale values.

## Appendix: full class list

<details>
<summary>All 1040 <code>gi-*</code> classes (sorted)</summary>

```text
gi--col-end-1
gi--col-end-10
gi--col-end-11
gi--col-end-12
gi--col-end-13
gi--col-end-2
gi--col-end-3
gi--col-end-4
gi--col-end-5
gi--col-end-6
gi--col-end-7
gi--col-end-8
gi--col-end-9
gi--col-start-1
gi--col-start-10
gi--col-start-11
gi--col-start-12
gi--col-start-13
gi--col-start-2
gi--col-start-3
gi--col-start-4
gi--col-start-5
gi--col-start-6
gi--col-start-7
gi--col-start-8
gi--col-start-9
gi--row-end-1
gi--row-end-10
gi--row-end-11
gi--row-end-12
gi--row-end-13
gi--row-end-2
gi--row-end-3
gi--row-end-4
gi--row-end-5
gi--row-end-6
gi--row-end-7
gi--row-end-8
gi--row-end-9
gi--row-start-1
gi--row-start-10
gi--row-start-11
gi--row-start-12
gi--row-start-13
gi--row-start-2
gi--row-start-3
gi--row-start-4
gi--row-start-5
gi--row-start-6
gi--row-start-7
gi--row-start-8
gi--row-start-9
gi-absolute
gi-accordion
gi-accordion-header
gi-accordion-item-container
gi-accordion-item-icon
gi-accordion-item-slot
gi-alert-base
gi-alert-base-dismissible
gi-alert-container
gi-alert-danger
gi-alert-dismiss
gi-alert-icon
gi-alert-info
gi-alert-success
gi-alert-title
gi-alert-warning
gi-align-baseline
gi-align-bottom
gi-align-middle
gi-align-sub
gi-align-super
gi-align-text-bottom
gi-align-text-top
gi-align-top
gi-basis-0
gi-basis-1
gi-basis-full
gi-bg-base-transparent
gi-bg-black
gi-bg-color-border-system-neutral-interactive-default
gi-bg-color-border-tone-primary-accent-selected
gi-bg-color-surface-intent-error-default
gi-bg-color-surface-intent-info-default
gi-bg-color-surface-intent-success-default
gi-bg-color-surface-intent-warning-default
gi-bg-color-surface-system-neutral-layer1
gi-bg-color-surface-system-neutral-layer11
gi-bg-color-surface-system-neutral-layer2
gi-bg-color-surface-system-primary-default
gi-bg-color-surface-system-primary-subtle
gi-bg-color-surface-tone-dark-fill-default
gi-bg-color-surface-tone-dark-fill-disabled
gi-bg-color-surface-tone-dark-flat-disabled
gi-bg-color-surface-tone-dark-outline-default
gi-bg-color-surface-tone-light-fill-default
gi-bg-color-surface-tone-light-fill-disabled
gi-bg-color-surface-tone-light-flat-default
gi-bg-color-surface-tone-light-flat-disabled
gi-bg-color-surface-tone-light-outline-disabled
gi-bg-color-surface-tone-primary-fill-default
gi-bg-color-surface-tone-primary-fill-disabled
gi-bg-color-surface-tone-primary-flat-disabled
gi-bg-color-surface-tone-primary-outline-disabled
gi-bg-color-text-system-neutral-interactive-default
gi-bg-gray-100
gi-bg-gray-200
gi-bg-gray-300
gi-bg-gray-400
gi-bg-gray-50
gi-bg-gray-900
gi-bg-white
gi-block
gi-blockquote
gi-border
gi-border-
gi-border-b
gi-border-b-color-surface-system-primary-default
gi-border-base-transparent
gi-border-color-border-intent-error-subtle
gi-border-color-border-intent-info-subtle
gi-border-color-border-intent-success-subtle
gi-border-color-border-intent-warning-subtle
gi-border-color-border-system-neutral-muted
gi-border-color-border-system-neutral-subtle
gi-border-color-border-tone-dark-outline-default
gi-border-color-border-tone-dark-outline-disabled
gi-border-color-border-tone-light-outline-default
gi-border-color-border-tone-light-outline-disabled
gi-border-color-border-tone-primary-outline-default
gi-border-color-border-tone-primary-outline-disabled
gi-border-gray-100
gi-border-gray-400
gi-border-gray-500
gi-border-gray-950
gi-border-hidden
gi-border-l-
gi-border-l-2xl
gi-border-l-gray-200
gi-border-sm
gi-border-solid
gi-border-t
gi-border-t-xs
gi-border-transparent
gi-border-white
gi-border-xs
gi-bottom-0
gi-bottom-full
gi-box-border
gi-breadcrumbs
gi-breadcrumbs-link
gi-breadcrumbs-separator
gi-btn
gi-btn-flat
gi-btn-flat-dark
gi-btn-flat-dark-disabled
gi-btn-flat-disabled
gi-btn-flat-light
gi-btn-flat-light-disabled
gi-btn-group
gi-btn-large
gi-btn-primary
gi-btn-primary-dark
gi-btn-primary-dark-disabled
gi-btn-primary-disabled
gi-btn-primary-light
gi-btn-primary-light-disabled
gi-btn-regular
gi-btn-secondary
gi-btn-secondary-dark
gi-btn-secondary-dark-disabled
gi-btn-secondary-disabled
gi-btn-secondary-light
gi-btn-secondary-light-disabled
gi-btn-small
gi-card
gi-card-action
gi-card-content
gi-card-header
gi-card-heading
gi-card-horizontal
gi-card-icon
gi-card-iframe
gi-card-image
gi-card-inset-body
gi-card-paragraph
gi-card-subheading
gi-card-tag
gi-card-title
gi-card-truncate-text
gi-card-vertical
gi-checkbox-indeterminate
gi-chip
gi-col-auto
gi-col-end-1
gi-col-end-10
gi-col-end-11
gi-col-end-12
gi-col-end-13
gi-col-end-2
gi-col-end-3
gi-col-end-4
gi-col-end-5
gi-col-end-6
gi-col-end-7
gi-col-end-8
gi-col-end-9
gi-col-end-auto
gi-col-span-1
gi-col-span-10
gi-col-span-11
gi-col-span-12
gi-col-span-2
gi-col-span-3
gi-col-span-4
gi-col-span-5
gi-col-span-6
gi-col-span-7
gi-col-span-8
gi-col-span-9
gi-col-span-full
gi-col-start-1
gi-col-start-10
gi-col-start-11
gi-col-start-12
gi-col-start-13
gi-col-start-2
gi-col-start-3
gi-col-start-4
gi-col-start-5
gi-col-start-6
gi-col-start-7
gi-col-start-8
gi-col-start-9
gi-col-start-auto
gi-combobox-checkbox
gi-combobox-checkbox-container
gi-combobox-checkbox-paragraph
gi-combobox-container
gi-combobox-dropdown-container-close
gi-combobox-dropdown-container-open
gi-combobox-dropdown-item
gi-combobox-search
gi-combobox-search-icon
gi-combobox-search-input
gi-combobox-toggle
gi-combobox-toggle-content
gi-cookie-banner-buttons
gi-cookie-banner-container
gi-cursor-col-resize
gi-cursor-default
gi-cursor-not-allowed
gi-cursor-pointer
gi-cursor-row-resize
gi-decoration-xs
gi-details
gi-details-summary
gi-details-summary-text
gi-details-text
gi-drawer-body
gi-drawer-container
gi-duration-300
gi-error-state
gi-error-text
gi-error-text-lg
gi-error-text-md
gi-error-text-sm
gi-fill-color-text-system-neutral-interactive-default
gi-fill-color-text-system-neutral-interactive-muted
gi-fill-gray-700
gi-flex
gi-flex-1
gi-flex-auto
gi-flex-col
gi-flex-col-reverse
gi-flex-grow-0
gi-flex-initial
gi-flex-none
gi-flex-nowrap
gi-flex-row
gi-flex-row-reverse
gi-flex-shrink
gi-flex-wrap
gi-flex-wrap-reverse
gi-focus-state-border
gi-focus-state-border-sm
gi-focus-state-border-sm-rounded
gi-focus-state-outline
gi-focus-state-outline-header
gi-focus-state-outline-inner-shadow-sm
gi-focus-visible-state-border
gi-focus-visible-state-border-sm
gi-focus-visible-state-border-sm-rounded
gi-focus-visible-state-outline
gi-focus-visible-state-outline-inner-shadow-sm
gi-focus-within-state-outline
gi-focus-within-state-outline-header
gi-font-bold
gi-font-medium
gi-font-normal
gi-font-primary
gi-footer
gi-footer-container
gi-footer-logo
gi-footer-secondary-slot
gi-footer-secondary-slot-content
gi-footer-utility
gi-gap-0
gi-gap-1
gi-gap-10
gi-gap-100
gi-gap-105
gi-gap-11
gi-gap-12
gi-gap-120
gi-gap-13
gi-gap-135
gi-gap-14
gi-gap-16
gi-gap-160
gi-gap-18
gi-gap-19
gi-gap-192
gi-gap-2
gi-gap-20
gi-gap-24
gi-gap-240
gi-gap-28
gi-gap-2xl
gi-gap-2xs
gi-gap-3
gi-gap-30
gi-gap-32
gi-gap-36
gi-gap-3xl
gi-gap-3xs
gi-gap-4
gi-gap-40
gi-gap-44
gi-gap-48
gi-gap-4xl
gi-gap-5
gi-gap-52
gi-gap-56
gi-gap-5xl
gi-gap-6
gi-gap-60
gi-gap-64
gi-gap-6xl
gi-gap-7
gi-gap-70
gi-gap-72
gi-gap-8
gi-gap-80
gi-gap-86
gi-gap-9
gi-gap-94
gi-gap-96
gi-gap-lg
gi-gap-md
gi-gap-none
gi-gap-outline-sm
gi-gap-px
gi-gap-sm
gi-gap-x-0
gi-gap-x-1
gi-gap-x-10
gi-gap-x-100
gi-gap-x-105
gi-gap-x-11
gi-gap-x-12
gi-gap-x-120
gi-gap-x-13
gi-gap-x-135
gi-gap-x-14
gi-gap-x-16
gi-gap-x-160
gi-gap-x-18
gi-gap-x-19
gi-gap-x-192
gi-gap-x-2
gi-gap-x-20
gi-gap-x-24
gi-gap-x-240
gi-gap-x-28
gi-gap-x-2xl
gi-gap-x-2xs
gi-gap-x-3
gi-gap-x-30
gi-gap-x-32
gi-gap-x-36
gi-gap-x-3xl
gi-gap-x-3xs
gi-gap-x-4
gi-gap-x-40
gi-gap-x-44
gi-gap-x-48
gi-gap-x-4xl
gi-gap-x-5
gi-gap-x-52
gi-gap-x-56
gi-gap-x-5xl
gi-gap-x-6
gi-gap-x-60
gi-gap-x-64
gi-gap-x-6xl
gi-gap-x-7
gi-gap-x-70
gi-gap-x-72
gi-gap-x-8
gi-gap-x-80
gi-gap-x-86
gi-gap-x-9
gi-gap-x-94
gi-gap-x-96
gi-gap-x-lg
gi-gap-x-md
gi-gap-x-none
gi-gap-x-outline-sm
gi-gap-x-px
gi-gap-x-sm
gi-gap-x-xl
gi-gap-x-xs
gi-gap-xl
gi-gap-xs
gi-gap-y-0
gi-gap-y-1
gi-gap-y-10
gi-gap-y-100
gi-gap-y-105
gi-gap-y-11
gi-gap-y-12
gi-gap-y-120
gi-gap-y-13
gi-gap-y-135
gi-gap-y-14
gi-gap-y-16
gi-gap-y-160
gi-gap-y-18
gi-gap-y-19
gi-gap-y-192
gi-gap-y-2
gi-gap-y-20
gi-gap-y-24
gi-gap-y-240
gi-gap-y-28
gi-gap-y-2xl
gi-gap-y-2xs
gi-gap-y-3
gi-gap-y-30
gi-gap-y-32
gi-gap-y-36
gi-gap-y-3xl
gi-gap-y-3xs
gi-gap-y-4
gi-gap-y-40
gi-gap-y-44
gi-gap-y-48
gi-gap-y-4xl
gi-gap-y-5
gi-gap-y-52
gi-gap-y-56
gi-gap-y-5xl
gi-gap-y-6
gi-gap-y-60
gi-gap-y-64
gi-gap-y-6xl
gi-gap-y-7
gi-gap-y-70
gi-gap-y-72
gi-gap-y-8
gi-gap-y-80
gi-gap-y-86
gi-gap-y-9
gi-gap-y-94
gi-gap-y-96
gi-gap-y-lg
gi-gap-y-md
gi-gap-y-none
gi-gap-y-outline-sm
gi-gap-y-px
gi-gap-y-sm
gi-gap-y-xl
gi-gap-y-xs
gi-grid
gi-grid-12-column
gi-grid-4-column
gi-grid-8-column
gi-grid-cols-1
gi-grid-cols-10
gi-grid-cols-11
gi-grid-cols-12
gi-grid-cols-2
gi-grid-cols-3
gi-grid-cols-4
gi-grid-cols-5
gi-grid-cols-6
gi-grid-cols-7
gi-grid-cols-8
gi-grid-cols-9
gi-grid-cols-none
gi-grid-cols-subgrid
gi-grid-flow-col
gi-grid-flow-col-dense
gi-grid-flow-dense
gi-grid-flow-row
gi-grid-flow-row-dense
gi-grid-responsive
gi-grid-rows-1
gi-grid-rows-10
gi-grid-rows-11
gi-grid-rows-12
gi-grid-rows-2
gi-grid-rows-3
gi-grid-rows-4
gi-grid-rows-5
gi-grid-rows-6
gi-grid-rows-7
gi-grid-rows-8
gi-grid-rows-9
gi-grid-rows-none
gi-grid-rows-subgrid
gi-group
gi-grow
gi-grow-0
gi-h-
gi-h-10
gi-h-12
gi-h-14
gi-h-16
gi-h-20
gi-h-4
gi-h-56
gi-h-6
gi-h-64
gi-h-8
gi-h-full
gi-h-screen
gi-header
gi-header-accordion-item-toggle
gi-header-divider
gi-header-logo
gi-header-logo-default
gi-header-logo-light
gi-header-menu
gi-header-menu-container
gi-header-menu-mobile-trigger
gi-header-mobile-menu-trigger
gi-header-nav
gi-header-overlay
gi-header-primary-menu
gi-header-secondary-bar
gi-header-secondary-item
gi-header-secondary-item-default
gi-header-secondary-item-light
gi-header-slot-container
gi-header-title
gi-header-tool-item
gi-header-tool-item-default
gi-header-tool-item-input
gi-header-tool-item-light
gi-heading-2xs
gi-heading-lg
gi-heading-md
gi-heading-sm
gi-heading-xl
gi-heading-xs
gi-hidden
gi-hint-text
gi-hint-text-lg
gi-hint-text-md
gi-hint-text-sm
gi-icon-btn-extra-large
gi-icon-btn-large
gi-icon-btn-regular
gi-icon-btn-small
gi-inline
gi-inline-block
gi-inline-flex
gi-input-checkbox
gi-input-checkbox-container
gi-input-checkbox-hint-container
gi-input-checkbox-large
gi-input-checkbox-medium
gi-input-checkbox-small
gi-input-disabled-state
gi-input-file
gi-input-group-container
gi-input-group-error
gi-input-group-options-container
gi-input-group-options-inline
gi-input-group-options-stacked
gi-input-half-width
gi-input-radio-base
gi-input-radio-conditional-divider-border
gi-input-radio-conditional-divider-border-container
gi-input-radio-conditional-divider-container
gi-input-radio-container
gi-input-radio-medium
gi-input-radio-small
gi-input-text
gi-input-text-action-before-suffix
gi-input-text-container
gi-input-text-end-element
gi-input-text-icon-end
gi-input-text-icon-start
gi-input-text-inner
gi-input-text-prefix
gi-input-text-suffix
gi-invisible
gi-items-center
gi-items-end
gi-items-start
gi-items-stretch
gi-justify-around
gi-justify-between
gi-justify-center
gi-justify-end
gi-justify-evenly
gi-justify-items-center
gi-justify-items-stretch
gi-justify-start
gi-justify-stretch
gi-label
gi-layout-column-1-2
gi-layout-column-1-3
gi-layout-column-2-3
gi-layout-container
gi-layout-container-2-column
gi-layout-container-3-column
gi-layout-container-full-width
gi-layout-container-inset
gi-layout-container-max-lg
gi-layout-container-max-xl
gi-leading-10
gi-leading-6
gi-left-0
gi-left-1
gi-left-full
gi-line-clamp-1
gi-link
gi-link-disabled
gi-link-icon
gi-link-icon-end
gi-link-icon-start
gi-link-inherit
gi-link-light
gi-link-no-underline
gi-link-no-visited
gi-list
gi-list-bullet
gi-list-item
gi-list-none
gi-list-number
gi-list-spaced
gi-max-h-100
gi-max-w-
gi-max-w-100
gi-max-w-52
gi-max-w-md
gi-max-w-none
gi-max-w-prose
gi-mb-0
gi-mb-1
gi-mb-2
gi-mb-4
gi-min-h-16
gi-min-h-6
gi-min-w-0
gi-min-w-full
gi-ml-
gi-ml-1
gi-ml-10
gi-ml-2
gi-ml-4
gi-ml-auto
gi-modal
gi-modal-body
gi-modal-close
gi-modal-container
gi-modal-container-bottom
gi-modal-container-center
gi-modal-container-control
gi-modal-container-left
gi-modal-container-open
gi-modal-container-right
gi-modal-footer
gi-modal-footer-stacked
gi-modal-open
gi-mr-2
gi-mt-1
gi-mt-2
gi-mt-3
gi-mt-4
gi-mt-8
gi-mx-0
gi-mx-20
gi-mx-auto
gi-my-20
gi-my-4
gi-no-underline
gi-opacity-100
gi-order-1
gi-order-2
gi-overflow-auto
gi-overflow-hidden
gi-overflow-visible
gi-overflow-x-auto
gi-overflow-x-hidden
gi-overflow-y-auto
gi-overflow-y-hidden
gi-p-
gi-p-1
gi-p-2
gi-p-3
gi-p-4
gi-p-6
gi-p-8
gi-pagination
gi-pagination-next-btn
gi-pagination-prev-btn
gi-paragraph-lg
gi-paragraph-md
gi-paragraph-sm
gi-paragraph-xl
gi-paragraph-xs
gi-pb-1
gi-pb-3
gi-pb-4
gi-pb-6
gi-phase-banner-container
gi-phase-banner-content
gi-pl-1
gi-pl-5
gi-pl-6
gi-pointer-events-none
gi-popover
gi-pr-1
gi-pr-2
gi-pr-5
gi-progress-bar
gi-progress-bar-container
gi-progress-bar-indeterminate
gi-progress-stepper
gi-progress-stepper-step
gi-progress-stepper-step-connector
gi-progress-stepper-step-container
gi-progress-stepper-step-label
gi-prose
gi-pt-
gi-pt-1
gi-pt-2
gi-pt-3
gi-pt-4
gi-pt-5
gi-pt-6
gi-px-1
gi-px-2
gi-px-24
gi-px-3
gi-px-4
gi-px-6
gi-px-8
gi-py-0
gi-py-1
gi-py-10
gi-py-2
gi-py-3
gi-py-4
gi-py-5
gi-relative
gi-right-2
gi-right-full
gi-rotate-180
gi-rounded
gi-rounded-md
gi-rounded-sm
gi-row-auto
gi-row-end-1
gi-row-end-10
gi-row-end-11
gi-row-end-12
gi-row-end-13
gi-row-end-2
gi-row-end-3
gi-row-end-4
gi-row-end-5
gi-row-end-6
gi-row-end-7
gi-row-end-8
gi-row-end-9
gi-row-end-auto
gi-row-span-1
gi-row-span-10
gi-row-span-11
gi-row-span-12
gi-row-span-2
gi-row-span-3
gi-row-span-4
gi-row-span-5
gi-row-span-6
gi-row-span-7
gi-row-span-8
gi-row-span-9
gi-row-span-full
gi-row-start-1
gi-row-start-10
gi-row-start-11
gi-row-start-12
gi-row-start-13
gi-row-start-2
gi-row-start-3
gi-row-start-4
gi-row-start-5
gi-row-start-6
gi-row-start-7
gi-row-start-8
gi-row-start-9
gi-row-start-auto
gi-score-select-button-group
gi-score-select-button-group-horizontal
gi-score-select-button-group-vertical
gi-score-select-labels
gi-score-select-labels-responsive
gi-score-select-labels-vertical
gi-secondary-label
gi-section-break-lg
gi-section-break-md
gi-section-break-sm
gi-section-break-xl
gi-select
gi-select-container
gi-select-icon
gi-select-menu-container
gi-select-menu-input-container
gi-select-menu-loading
gi-select-menu-option-container
gi-select-menu-option-not-found
gi-select-next
gi-select-option-item
gi-select-option-item-disabled
gi-select-option-item-highlighted
gi-shrink-0
gi-side-nav-container
gi-side-nav-expandable-icon
gi-side-nav-heading
gi-side-nav-item
gi-side-nav-item-content
gi-side-nav-item-icon
gi-side-nav-item-label
gi-side-nav-item-left
gi-side-nav-item-primary
gi-side-nav-item-secondary
gi-side-nav-item-selected
gi-snap-align-none
gi-space-x-2
gi-space-y-2
gi-span-lg
gi-span-md
gi-span-sm
gi-span-xl
gi-sr-only
gi-stroke-color-text-system-neutral-muted
gi-stroke-color-text-tone-dark-fill-default
gi-stroke-color-text-tone-dark-fill-disabled
gi-stroke-color-text-tone-dark-flat-default
gi-stroke-color-text-tone-dark-flat-disabled
gi-stroke-color-text-tone-dark-outline-disabled
gi-stroke-color-text-tone-light-fill-default
gi-stroke-color-text-tone-light-fill-disabled
gi-stroke-color-text-tone-light-flat-default
gi-stroke-color-text-tone-light-flat-disabled
gi-stroke-color-text-tone-light-outline-default
gi-stroke-color-text-tone-light-outline-disabled
gi-stroke-color-text-tone-primary-fill-default
gi-stroke-color-text-tone-primary-fill-disabled
gi-stroke-color-text-tone-primary-flat-default
gi-stroke-color-text-tone-primary-flat-disabled
gi-stroke-color-text-tone-primary-outline-default
gi-stroke-color-text-tone-primary-outline-disabled
gi-stroke-gray-700
gi-stroke-gray-950
gi-stroke-white
gi-summary-list
gi-summary-list-action
gi-tab-indicator
gi-tab-item
gi-tab-item-border
gi-tab-item-checked
gi-tab-list
gi-tab-list-stretch
gi-tab-panel
gi-table
gi-table-auto
gi-table-caption-text
gi-table-data-cell
gi-table-data-slot-container
gi-table-expand-icon-container
gi-table-fixed
gi-table-loading
gi-table-no-border
gi-table-no-data
gi-table-pagination
gi-table-pagination-label
gi-table-row-group
gi-table-td
gi-table-td-fluid
gi-table-td-lg-flex
gi-table-td-md-fixed
gi-table-td-sm-fixed
gi-table-td-xs-fixed
gi-table-th
gi-table-th-fluid
gi-table-th-lg-flex
gi-table-th-md-fixed
gi-table-th-sm-fixed
gi-table-th-xs-fixed
gi-tabs
gi-tag
gi-tag-counter
gi-tag-counter-warning
gi-tag-default
gi-tag-error
gi-tag-info
gi-tag-size-default
gi-tag-size-small
gi-tag-success
gi-tag-warning
gi-text-2md
gi-text-2xl
gi-text-4xl
gi-text-area-end-element
gi-text-area-icon-start
gi-text-black
gi-text-brand-neutral-600
gi-text-center
gi-text-color-icon-intent-error-default
gi-text-color-icon-intent-info-default
gi-text-color-icon-intent-success-default
gi-text-color-icon-intent-warning-default
gi-text-color-text-intent-error-default
gi-text-color-text-intent-info-default
gi-text-color-text-intent-success-default
gi-text-color-text-intent-warning-default
gi-text-color-text-system-neutral-default
gi-text-color-text-system-neutral-interactive-default
gi-text-color-text-system-neutral-interactive-muted
gi-text-color-text-system-neutral-muted
gi-text-color-text-tone-dark-fill-default
gi-text-color-text-tone-dark-fill-disabled
gi-text-color-text-tone-dark-flat-default
gi-text-color-text-tone-dark-flat-disabled
gi-text-color-text-tone-dark-outline-disabled
gi-text-color-text-tone-light-default
gi-text-color-text-tone-light-fill-default
gi-text-color-text-tone-light-fill-disabled
gi-text-color-text-tone-light-flat-default
gi-text-color-text-tone-light-flat-disabled
gi-text-color-text-tone-light-outline-default
gi-text-color-text-tone-light-outline-disabled
gi-text-color-text-tone-primary-fill-default
gi-text-color-text-tone-primary-fill-disabled
gi-text-color-text-tone-primary-flat-default
gi-text-color-text-tone-primary-flat-disabled
gi-text-color-text-tone-primary-outline-default
gi-text-color-text-tone-primary-outline-disabled
gi-text-ellipsis
gi-text-end
gi-text-gray-500
gi-text-gray-600
gi-text-gray-700
gi-text-gray-800
gi-text-gray-950
gi-text-justify
gi-text-left
gi-text-lg
gi-text-md
gi-text-right
gi-text-sm
gi-text-start
gi-text-white
gi-text-xs
gi-textarea
gi-textarea-container
gi-textarea-error
gi-textarea-inner
gi-textarea-remaining-chars
gi-toast
gi-toast-action
gi-toast-base
gi-toast-base-dismissible
gi-toast-container
gi-toast-danger
gi-toast-disappear
gi-toast-dismiss
gi-toast-icon
gi-toast-info
gi-toast-message
gi-toast-portal
gi-toast-success
gi-toast-title
gi-toast-warning
gi-toast-wrapper
gi-tooltip
gi-tooltip-bottom
gi-tooltip-left
gi-tooltip-right
gi-tooltip-top
gi-tooltip-wrapper
gi-top-1
gi-top-2
gi-top-full
gi-transition-opacity
gi-translate-x-
gi-translate-y-
gi-truncate
gi-underline
gi-w-
gi-w-1
gi-w-10
gi-w-12
gi-w-32
gi-w-4
gi-w-48
gi-w-56
gi-w-6
gi-w-72
gi-w-8
gi-w-auto
gi-w-fit
gi-w-full
gi-w-max
gi-whitespace-break-spaces
gi-whitespace-normal
gi-whitespace-nowrap
gi-whitespace-pre
gi-whitespace-pre-wrap
gi-z-
gi-z-1
```

</details>
