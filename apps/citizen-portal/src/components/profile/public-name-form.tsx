"use client"

import { useEnv } from "@citizen-portal/shared"
import {
  FormField,
  FormFieldError,
  FormFieldLabel,
  Heading,
  Stack,
  TextInput,
  toaster,
} from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { type FormEvent, useCallback, useState } from "react"
import { FullWidthContainer } from "@/components/layout/containers"

export function PublicNameForm({
  publicName,
  profileId,
  onUpdated,
}: {
  publicName: string
  profileId: string
  onUpdated: () => void
}) {
  const t = useTranslations("profile")
  const { sagUrl } = useEnv()
  const [value, setValue] = useState(publicName)
  const [validationError, setValidationError] = useState<string | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const trimmed = value.trim()

      if (!trimmed) {
        setValidationError(t("emptyPublicName"))
        return
      }

      setValidationError(undefined)
      setIsSubmitting(true)

      try {
        const response = await fetch(
          `${sagUrl}/profile/api/v1/profiles/${profileId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ publicName: trimmed }),
          },
        )

        if (!response.ok) {
          throw new Error("Failed to update public name")
        }

        toaster.create({
          title: t("publicNameUpdatedToast"),
          position: { x: "right", y: "top" },
          variant: "success",
        })
        onUpdated()
      } catch {
        toaster.create({
          title: t("publicNameFailedUpdatedToast"),
          position: { x: "right", y: "top" },
          variant: "danger",
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [value, t, onUpdated, profileId, sagUrl],
  )

  return (
    <FullWidthContainer>
      <form onSubmit={handleSubmit} data-testid='public-name-form'>
        <Stack direction='column' gap={6}>
          <Heading as='h2' size='md' data-testid='public-name-heading'>
            {t("form.title")}
          </Heading>
          <FormField>
            <FormFieldLabel text={t("form.description")} htmlFor='publicName' />
            {validationError && <FormFieldError text={validationError} />}
            <TextInput
              id='publicName'
              name='publicName'
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid='public-name-input'
            />
          </FormField>
          <div>
            <button
              type='submit'
              className='gi-btn gi-btn-primary gi-btn-regular'
              disabled={isSubmitting}
              data-testid='public-name-submit'
            >
              {t("update")}
            </button>
          </div>
        </Stack>
      </form>
    </FullWidthContainer>
  )
}
