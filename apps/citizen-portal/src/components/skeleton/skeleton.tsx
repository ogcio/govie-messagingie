import styles from "./skeleton.module.css"

export interface SkeletonProps {
  /** Any CSS length or percentage. Defaults to filling the container. */
  width?: string
  /** Any CSS length. Defaults to a single line of the inherited text size. */
  height?: string
  className?: string
  dataTestid?: string
}

/**
 * Loading placeholder for a value that is still being fetched — use it
 * instead of rendering a "missing value" fallback (e.g. "Unknown sender")
 * that would later be replaced by the real one, which reads as wrong data
 * rather than as loading.
 *
 * Decorative: it is hidden from assistive tech, so the region that swaps
 * it in should carry `aria-busy` (and any accessible label) itself.
 */
export function Skeleton({
  width = "100%",
  height = "1em",
  className,
  dataTestid,
}: SkeletonProps) {
  return (
    <span
      aria-hidden='true'
      data-testid={dataTestid}
      className={[styles.skeleton, className].filter(Boolean).join(" ")}
      style={{ width, height }}
    />
  )
}
