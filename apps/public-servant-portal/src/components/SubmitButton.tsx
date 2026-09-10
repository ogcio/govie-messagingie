import { Button, Spinner } from "@ogcio/design-system-react"
import type { PropsWithChildren } from "react"
import { useFormStatus } from "react-dom"

export const SubmitButton = (
  props: PropsWithChildren<{ disabled?: boolean; className?: string }>,
) => {
  const status = useFormStatus()
  return (
    <Button
      type='submit'
      disabled={props.disabled || status.pending}
      className={props.className}
    >
      {props.children}
      {status.pending && <Spinner />}
    </Button>
  )
}
