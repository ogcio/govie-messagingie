import type { SVGProps } from "react"

export type IconSize = "sm" | "md" | "lg" | "xl"

const sizeMap: Record<IconSize, number> = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
}

export function resolveSize(size: IconSize | undefined): number {
  return sizeMap[size ?? "md"]
}

export type SvgIconProps = {
  size?: IconSize
  className?: string
} & Omit<SVGProps<SVGSVGElement>, "children">
