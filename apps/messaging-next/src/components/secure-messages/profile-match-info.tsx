"use client"

import { Paragraph, Stack } from "@ogcio/design-system-react"
import { DEFAULT_AUTH_PROVIDER, DEFAULT_STACK_GAP } from "./const"
import { MaskEmail } from "./mask-email"

export function ProfileMatchInfo({
  currentEmail,
  matchedEmail,
}: {
  currentEmail: string
  matchedEmail: string
}) {
  return (
    <Stack direction='column' gap={DEFAULT_STACK_GAP}>
      <Stack direction='row' gap={DEFAULT_STACK_GAP}>
        <Paragraph>{DEFAULT_AUTH_PROVIDER}:</Paragraph>
        <Paragraph>{currentEmail}</Paragraph>
      </Stack>
      <Stack direction='row' gap={DEFAULT_STACK_GAP}>
        <Paragraph>Registered Email:</Paragraph>
        <Paragraph>
          <MaskEmail email={matchedEmail} />
        </Paragraph>
      </Stack>
    </Stack>
  )
}
