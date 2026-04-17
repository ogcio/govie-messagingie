import type { SvgIconProps } from "./types"
import { resolveSize } from "./types"

export function MenuIcon({ size, className, ...props }: SvgIconProps) {
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
      <path d='M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z' />
    </svg>
  )
}
