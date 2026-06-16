import { Button } from "@ogcio/design-system-react"
import type { PropsWithChildren } from "react"
import { useFormStatus } from "react-dom"

export const CancelButton = ({
  children,
  onClick,
}: PropsWithChildren<{ onClick: () => void }>) => {
  const status = useFormStatus()
  const handleClick = (_e: React.MouseEvent<HTMLButtonElement>) => {
    if (status.pending) {
      return
    }

    onClick()
  }
  return (
    <Button
      type='button'
      variant='secondary'
      onClick={handleClick}
      disabled={status.pending}
    >
      {children}
    </Button>
  )
}
