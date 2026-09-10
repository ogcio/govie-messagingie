import type { SvgIconProps } from "./types"
import { resolveSize } from "./types"

/**
 * Inline SVG for `delete`. DS Icon falls through to the Material
 * Symbols web font for this name; when the font fails to load the
 * ligature string renders as visible/accessible text.
 */
export function DeleteIcon({ size, className, ...props }: SvgIconProps) {
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
      <path d='M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z' />
    </svg>
  )
}
