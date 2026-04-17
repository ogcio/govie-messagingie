"use client"

import {
  Button,
  FormField,
  FormFieldError,
  FormFieldHint,
  FormFieldLabel,
  Heading,
  InputText,
  Spinner,
  Stack,
} from "@ogcio/design-system-react"
import { type ChangeEvent, useState, useTransition } from "react"
import type { LinkProfile } from "@/data/types"
import { getAccountLinkDetailsAction } from "@/utils/actions"

type LookupFormProps = {
  submitCallback: (profile: LinkProfile) => void
}

export function LookupForm(props: LookupFormProps) {
  const [email, setEmail] = useState("")
  const [resultError, setResultError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleEmailInputChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    if (!e.target.value) {
      setResultError(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending) {
      return
    }

    startTransition(async () => {
      const actionResult = await getAccountLinkDetailsAction({
        type: "email",
        value: email,
      })

      if (!actionResult.success) {
        setResultError(actionResult.userMessage)
        return
      }
      props.submitCallback(actionResult.value)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack direction='column' gap={3}>
        <Heading as='h4'>Search for an account to link as child</Heading>
        <FormField>
          <FormFieldLabel htmlFor='email-input'>Email</FormFieldLabel>
          {!resultError && (
            <FormFieldHint>
              Enter the exact address of the account you want to set as child
            </FormFieldHint>
          )}
          {resultError && <FormFieldError>{resultError}</FormFieldError>}
          <InputText
            id='email-input'
            type='email'
            placeholder='Search...'
            value={email}
            onChange={handleEmailInputChange}
            clearButtonEnabled
            autoComplete='off'
          />
        </FormField>
        <Button type='submit' disabled={isPending || !email.length}>
          Find account {isPending && <Spinner />}
        </Button>
      </Stack>
    </form>
  )
}
