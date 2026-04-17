"use client"

import { IconButton, Link, Popover, Stack } from "@ogcio/design-system-react"
import { useSearchParams } from "next/navigation"
import { useRef, useState } from "react"

export function PopoverLinks(props: { profileId: string }) {
  const params = useSearchParams()
  const actionref = useRef(null)
  const [open, setOpen] = useState(false)

  const urlSearchParams = params.toString()
  return (
    <>
      <IconButton
        icon={{
          icon: "more_horiz",
          "aria-description":
            "Shows popover with different links for the profile row",
        }}
        appearance={"light"}
        ref={actionref}
        onClick={() => setOpen(!open)}
      />
      <Popover triggerRef={actionref} open={open} onOpenChange={setOpen}>
        <Stack direction='column' gap={2} className='gi-p-6'>
          <Link
            noVisited
            href={`/${props.profileId}/profile?${urlSearchParams}`}
          >
            Profile
          </Link>
          <Link
            noVisited
            href={`/${props.profileId}/messaging?${urlSearchParams}`}
          >
            Messaging
          </Link>
          <Link
            noVisited
            href={`/${props.profileId}/account-linking?${urlSearchParams}`}
          >
            Accounts Linking
          </Link>
          <Link
            noVisited
            href={`/${props.profileId}/account-management?${urlSearchParams}`}
          >
            Account Management
          </Link>
        </Stack>
      </Popover>
    </>
  )
}
