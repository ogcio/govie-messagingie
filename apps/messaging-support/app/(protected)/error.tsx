"use client"

import { Button, Heading, Paragraph, Stack } from "@ogcio/design-system-react"

function SignedInErrorFallback() {
  return (
    <Stack direction='column' gap={5}>
      <Heading>Oh no!</Heading>
      <Paragraph>
        There has been an unexpected error on our side. Please try refresh the
        browser.
      </Paragraph>
      <Paragraph>
        You can also try to
        <span>
          <form action='/api/auth/signout'>
            <Button>Sign Out</Button>
          </form>
        </span>
        and sign back in
      </Paragraph>
    </Stack>
  )
}

export default SignedInErrorFallback
