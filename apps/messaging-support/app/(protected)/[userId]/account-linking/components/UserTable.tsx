"use client"

import {
  SummaryList,
  SummaryListHeader,
  SummaryListRow,
  SummaryListValue,
} from "@ogcio/design-system-react"
import type { UserRelations } from "@/data/types"

export function UserTable(props: { userRelations: UserRelations }) {
  const FIXED_COL_WIDTH = "60%"

  const { userRelations } = props
  return (
    <SummaryList withBorder>
      <SummaryListHeader label='Account' />
      <SummaryListRow withBorder label='Logto ID'>
        <SummaryListValue width={FIXED_COL_WIDTH}>
          {userRelations.userData?.id}
        </SummaryListValue>
      </SummaryListRow>
      <SummaryListRow withBorder label='Email'>
        <SummaryListValue width={FIXED_COL_WIDTH}>
          {userRelations.userData?.email}
        </SummaryListValue>
      </SummaryListRow>
      <SummaryListRow label='User is'>
        <SummaryListValue width={FIXED_COL_WIDTH}>
          {userRelations.userIs}
        </SummaryListValue>
      </SummaryListRow>
    </SummaryList>
  )
}
