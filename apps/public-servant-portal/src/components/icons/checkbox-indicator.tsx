import type { SvgIconProps } from "./types"
import { resolveSize } from "./types"

/**
 * Visual-only checkbox indicator used inside the mobile message row button
 * (where a real `<input type="checkbox">` is not valid HTML because it would
 * be nested inside another interactive `<button>`). The parent button owns
 * the selection semantics via `aria-pressed`.
 *
 * The SVG is a 1:1 port of the DS `InputCheckbox` pseudo-element geometry
 * so both checkboxes render identically:
 *
 *   Frame — `.gi-input-checkbox-small`:
 *     24×24 (`space-6`) box, `border-width-200` (2px) + `border-radius-100`
 *     (2px) + `border-color: --gieds-color-border-system-neutral-default`.
 *     Drawn as `rect x=1 y=1 w=22 h=22 rx=2 strokeWidth=2` so the stroke
 *     occupies the exact same 24×24 footprint as DS's `border-box`.
 *
 *   Checked — `.gi-input-checkbox-small:checked::before`:
 *     A 16×8 rectangle positioned at `left:space-0-5 top:space-1` (i.e.
 *     `(2, 4)` inside the 20×20 content area that starts at `(2, 2)`),
 *     with `border-left-width-400` + `border-bottom-width-400` (4px), all
 *     rotated `-45deg` around its own centre.
 *
 *     In SVG coordinates the ::before renders at `(4, 6) → (20, 14)` with
 *     centre `(12, 10)`. The L-shape (border-left ∪ border-bottom) is
 *     replicated by a stroked polyline whose centrelines sit in the middle
 *     of each 4px border: `(6, 6) → (6, 12) → (20, 12)`. With
 *     `strokeWidth=4`, butt caps, miter join, the filled region is
 *     exactly `(x 4–8, y 6–14) ∪ (x 4–20, y 10–14)` — the same L DS's
 *     CSS produces — and `rotate(-45 12 10)` applies the identical
 *     rotation DS uses via `transform-origin: 50% 50%`.
 *
 *   Indeterminate — `.gi-input-checkbox-small.gi-checkbox-indeterminate:checked::before`:
 *     A 12×1 rectangle at `left:space-1 top:9px` (rendered at `(6, 11)`)
 *     with `border-bottom-width-200` (2px) and no rotation. Replicated
 *     by a stroked `line` from `(6, 12) → (18, 12)` with `strokeWidth=2`
 *     and butt caps, which fills `(x 6–18, y 11–13)` — the same dash.
 *     Takes precedence over the `checked` branch so a partially-selected
 *     page always reads as "mixed".
 *
 * `currentColor` lets ancestor text colour drive both the frame and the
 * glyph — e.g. the mobile row (`--gieds-color-border-system-neutral-default`,
 * the same token DS uses) and the dark select-mode header
 * (`--gieds-color-gray-50`) pick up the right tone without extra props.
 */
export function CheckboxIndicatorIcon({
  size,
  className,
  checked = false,
  indeterminate = false,
  ...props
}: SvgIconProps & { checked?: boolean; indeterminate?: boolean }) {
  const px = resolveSize(size)
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      width={px}
      height={px}
      className={className}
      aria-hidden='true'
      {...props}
    >
      <rect
        x='1'
        y='1'
        width='22'
        height='22'
        rx='2'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
      />
      {indeterminate ? (
        <line
          x1='6'
          y1='12'
          x2='18'
          y2='12'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='butt'
        />
      ) : checked ? (
        <g transform='rotate(-45 12 10)'>
          <polyline
            points='6,6 6,12 20,12'
            fill='none'
            stroke='currentColor'
            strokeWidth='4'
            strokeLinecap='butt'
            strokeLinejoin='miter'
          />
        </g>
      ) : null}
    </svg>
  )
}
