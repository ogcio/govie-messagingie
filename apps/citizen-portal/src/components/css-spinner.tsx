import styles from "./css-spinner.module.css"

type CssSpinnerProps = {
  size?: "sm" | "md" | "lg" | "xl"
  dataTestid?: string
}

const SIZE_CLASS: Record<NonNullable<CssSpinnerProps["size"]>, string> = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
  xl: styles.xl,
}

/**
 * Drop-in replacement for the Design System `Spinner` that animates on the
 * compositor thread (CSS `transform`) instead of SVG SMIL. This prevents the
 * "frozen spinner" effect while the main thread is busy hydrating or fetching.
 *
 * Decorative only: the surrounding loading region carries the accessible label.
 */
export function CssSpinner({ size = "md", dataTestid }: CssSpinnerProps) {
  return (
    <span
      aria-hidden='true'
      data-testid={dataTestid}
      className={`${styles.spinner} ${SIZE_CLASS[size]}`}
    />
  )
}
