import type { SvgIconProps } from "./types"
import { resolveSize } from "./types"

export function DownloadIcon({ size, className, ...props }: SvgIconProps) {
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
      <path d='M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z' />
    </svg>
  )
}
