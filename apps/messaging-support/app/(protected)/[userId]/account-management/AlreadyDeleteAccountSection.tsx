"use client"

import { Alert, Paragraph } from "@ogcio/design-system-react"
import type { MainProfile } from "@/data/types"

export function AlreadyDeletedAccountSection(props: { profile: MainProfile }) {
  return (
    <Alert variant='warning' title='Warning'>
      <Paragraph size='sm'>
        This account for {props.profile.publicName} has already been planned for
        deletion.
      </Paragraph>
    </Alert>
  )
}
