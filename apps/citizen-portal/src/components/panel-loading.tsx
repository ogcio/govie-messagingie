import { CssSpinner } from "@/components/css-spinner"

type PanelLoadingProps = {
  ariaLabel: string
  minHeight?: string
}

export function PanelLoading({
  ariaLabel,
  minHeight = "6rem",
}: PanelLoadingProps) {
  return (
    <output
      aria-label={ariaLabel}
      className='gi-flex gi-items-center gi-justify-center'
      style={{ minHeight }}
    >
      <CssSpinner size='lg' />
    </output>
  )
}
