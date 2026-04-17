"use client"

import { Heading, Link, Paragraph, Stack } from "@ogcio/design-system-react"
import { useSearchParams } from "next/navigation"
import { type AuthErrorKey, authErrors, isAuthError } from "@/utils/auth"

export default function Page() {
  const params = useSearchParams()
  const reason = params.get("reason") || ""
  const authErrorKey: AuthErrorKey = isAuthError(reason) ? reason : "unknown"
  const authErrorMessage = authErrors[authErrorKey]

  return (
    <Stack direction='column' gap={4}>
      <Heading>Authentication error</Heading>
      <Paragraph>{authErrorMessage}</Paragraph>
      <Link href='/api/auth/signin'>Try logging in again</Link>
    </Stack>
  )
}
