"use client"

import { Button, Heading, Paragraph, Tag } from "@ogcio/design-system-react"
import type { LinkProfile } from "@/data/types"

export function CircularProfile(props: {
  profile: LinkProfile
  onCancel: () => void
}) {
  return (
    <>
      <Tag type='warning' text='Notice'></Tag>
      <Heading as='h3'>This account belongs to the same linked group</Heading>
      <Paragraph>
        This account is part of the same linked account group as the current
        profile.
      </Paragraph>

      <div>
        <Heading as='h4'>{props.profile.name}</Heading>
        <Paragraph size='sm'>{props.profile.email}</Paragraph>
      </div>
      <Paragraph size='sm'>Logto ID: {props.profile.id}</Paragraph>

      <Button onClick={props.onCancel}>Back</Button>
    </>
  )
}
