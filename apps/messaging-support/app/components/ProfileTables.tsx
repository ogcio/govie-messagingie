"use client"

import {
  Heading,
  Stack,
  SummaryList,
  SummaryListHeader,
  SummaryListRow,
  SummaryListValue,
} from "@ogcio/design-system-react"
import type { MainProfile } from "@/data/types"

export function ProfileTables(props: { profile: MainProfile }) {
  const { profile } = props

  const FIXED_COL_WIDTH = "60%"
  return (
    <Stack direction='column' gap={3}>
      <Heading as='h4'>Profile</Heading>
      <Stack direction='column' gap={7}>
        <SummaryList withBorder>
          <SummaryListHeader label='Name' />
          <SummaryListRow withBorder label='Public name'>
            <SummaryListValue width={FIXED_COL_WIDTH}>
              {profile.publicName}
            </SummaryListValue>
          </SummaryListRow>
          <SummaryListRow withBorder label='First name'>
            <SummaryListValue width={FIXED_COL_WIDTH}>
              {profile.firstName}
            </SummaryListValue>
          </SummaryListRow>
          <SummaryListRow label='Last name'>
            <SummaryListValue width={FIXED_COL_WIDTH}>
              {profile.lastName}
            </SummaryListValue>
          </SummaryListRow>
        </SummaryList>

        <SummaryList withBorder>
          <SummaryListHeader label='PPSN' />
          <SummaryListRow withBorder label='PPSN'>
            <SummaryListValue width={FIXED_COL_WIDTH}>
              {profile.ppsn}
            </SummaryListValue>
          </SummaryListRow>
        </SummaryList>

        <SummaryList withBorder>
          <SummaryListHeader label='Contact details' />
          <SummaryListRow withBorder label='Email'>
            <SummaryListValue width={FIXED_COL_WIDTH}>
              {profile.email}
            </SummaryListValue>
          </SummaryListRow>
        </SummaryList>
      </Stack>
    </Stack>
  )
}
