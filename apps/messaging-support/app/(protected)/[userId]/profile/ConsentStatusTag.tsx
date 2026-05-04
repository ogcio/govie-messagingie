import { Tag } from "@ogcio/design-system-react"
import type { Consent } from "@/data/types"

export function ConsentStatusTag(props: { status: Consent["status"] }) {
  switch (props.status) {
    case "pre-approved":
    case "opted-in":
      return <Tag text='Accepted' type='success' />
    case "opted-out":
      return <Tag text='Declined' type='error' />
    case "pending":
    case "undefined":
      return <Tag text='Pending' type='info' />
    default:
      return null
  }
}
