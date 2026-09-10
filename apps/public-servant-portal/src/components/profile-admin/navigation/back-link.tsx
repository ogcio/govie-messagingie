"use client"

import { Icon, Link, Stack } from "@ogcio/design-system-react"
import type { PropsWithChildren } from "react"

export function BackLink(props: PropsWithChildren<{ href: string }>) {
  if (!props.children) {
    return null
  }

  return (
    <Stack direction='row' gap={0}>
      <Icon icon='chevron_left' size='md' />
      <Link noColor href={props.href}>
        {props.children as React.ReactNode}
      </Link>
    </Stack>
  )
}

export function BackButton(props: PropsWithChildren<{ onClick: () => void }>) {
  if (!props.children) {
    return null
  }

  return (
    <Stack direction='row' gap={0}>
      <Icon icon='chevron_left' size='md' />
      <Link noColor onClick={props.onClick} style={{ cursor: "pointer" }}>
        {props.children as React.ReactNode}
      </Link>
    </Stack>
  )
}
