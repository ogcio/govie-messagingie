import { CssSpinner } from "@/components/css-spinner"

type PageLoadingProps = {
  minHeight?: string
  ariaLabel?: string
  size?: "lg" | "xl"
}

export function PageLoading({
  minHeight = "30vh",
  ariaLabel = "Loading",
  size = "xl",
}: PageLoadingProps) {
  return (
    <output
      aria-label={ariaLabel}
      className='gi-flex gi-items-center gi-justify-center'
      style={{ minHeight }}
    >
      <CssSpinner size={size} />
    </output>
  )
}
