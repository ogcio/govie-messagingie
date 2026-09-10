import type { SvgIconProps } from "./types"
import { resolveSize } from "./types"

/**
 * DS gap: `@ogcio/design-system-react` ships an inline-SVG icon set for
 * `close`, `visibility`, `chevron_left`, `first_page`, etc. (see
 * `atoms/icons/` in the package) but does NOT include a Search atom —
 * the DS Icon component falls back to the Material Symbols web font
 * for `icon="search"`. DS's `LoadMaterialSymbols` component preloads
 * the Google Fonts CSS with `opsz,wght,FILL,GRAD@20..48,400,0..1,0`,
 * i.e. `opsz` is only variable in the 20–48px range. When the icon
 * lands inside `InputText.inputActionButton` — which hard-codes
 * `size: "small"` = 16px on the inner `<Icon>` — the browser ends up
 * rendering the glyph at `fontSize: 16px` with `opsz: 16`, clamped
 * out of the valid range. The result is the thin, tiny, barely-
 * readable lens that used to sit in this input.
 *
 * This component is a 1:1 port of the Material Symbols Outlined
 * `search` glyph at `wght=400` into the same shape DS uses for its
 * own atom icons (`atoms/icons/Close.js` is the reference):
 *   - `viewBox="0 -960 960 960"` — Material Symbols' native coord
 *     space (960×960, origin at top-left after the negative Y shift).
 *   - `fill="currentColor"` so ancestor text colour drives the tone
 *     (dark-on-light inside the search input, light-on-dark if we
 *     ever reuse this on the bulk-action banner surface, etc.).
 *   - A single `<path d=...>` whose coordinates are the exact outlined
 *     search path exported by Google's Material Symbols family at
 *     `wght=400`, so the glyph renders pixel-identical to what DS's
 *     `<Icon icon="search" />` produces via the Material Symbols font
 *     at its correct `opsz` (20–48) — just without the font-loading
 *     race and without the 16px clamp.
 *
 * Removable if DS ever ships an inline `Search` atom in
 * `atoms/icons/` alongside `Close`, `Visibility`, etc.
 */
export function SearchIcon({ size, className, ...props }: SvgIconProps) {
  const px = resolveSize(size)
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 -960 960 960'
      width={px}
      height={px}
      fill='currentColor'
      className={className}
      aria-hidden='true'
      {...props}
    >
      <path d='M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z' />
    </svg>
  )
}
