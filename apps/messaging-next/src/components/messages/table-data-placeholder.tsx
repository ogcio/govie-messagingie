import { Spinner } from "@ogcio/design-system-react"

export function TableDataPlaceholder({ height }: { height: number }) {
  return (
    <td
      colSpan={3}
      style={{ position: "relative", width: "100%", height: `${height}px` }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Spinner size='xl' />
      </div>
    </td>
  )
}
