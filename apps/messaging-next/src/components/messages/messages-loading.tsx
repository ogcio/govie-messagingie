import { Spinner } from "@ogcio/design-system-react"

export function MessagesLoading() {
  return (
    <output
      aria-label='Loading'
      className='gi-flex gi-items-center gi-justify-center'
      style={{ minHeight: "30vh" }}
    >
      <Spinner size='xl' />
    </output>
  )
}
