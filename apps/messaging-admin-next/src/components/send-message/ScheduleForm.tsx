"use client"

import {
  Button,
  FormField,
  Heading,
  Paragraph,
  Radio,
  Spinner,
  Stack,
  TextInput,
  toaster,
} from "@ogcio/design-system-react"
import { useAnalytics } from "@ogcio/nextjs-analytics"
import { useTranslations } from "next-intl"
import { useContext, useEffect, useState } from "react"
import { BackButton } from "@/components/BackButton"
import { ANALYTICS } from "@/const/analytics"
import { useCreateMessages } from "@/hooks/use-create-messages"
import { buildSchedule, defaultFormGap, today } from "@/util/datetime"
import { SendMessageContext } from "./SendMessageContext"

export default function ScheduleForm() {
  const t = useTranslations("message.wizard.step.schedule")
  const [dateTimeErrors, setDateTimeErrors] = useState<{
    date?: string
    time?: string
  }>({})
  const { message, onStep, pendingFiles } = useContext(SendMessageContext)
  const [selectedSchedule, setSelectedSchedule] = useState("now")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const analyticsClient = useAnalytics()
  const createMessages = useCreateMessages()

  useEffect(() => {
    analyticsClient.trackEvent({
      event: {
        name: ANALYTICS.message.stepSchedule.name,
        category: ANALYTICS.message.category,
        action: ANALYTICS.message.stepSchedule.action,
      },
    })
  }, [analyticsClient])

  const handleSubmit = async (formData: FormData) => {
    const { templateMetaId, userIds, securityLevel } = message
    if (!templateMetaId || !userIds || !securityLevel) return

    const date = formData.get("scheduleDate") as string
    const time = formData.get("scheduleTime") as string
    setDateTimeErrors({})

    if (selectedSchedule === "future" && !date) {
      setDateTimeErrors({ date: t("input.error.date") })
      return
    }

    if (selectedSchedule === "future" && !time) {
      setDateTimeErrors({ time: t("input.error.time") })
      return
    }

    const schedule =
      selectedSchedule === "now" ? buildSchedule() : buildSchedule(date, time)

    setIsSubmitting(true)
    try {
      const state = await createMessages({
        templateMetaId,
        userIds,
        schedule,
        securityLevel,
        pendingFiles,
      })

      if (state.created === 0 && Object.keys(state.errors).length > 0) {
        toaster.create({
          title: t("toaster.title.serverError"),
          position: { x: "right", y: "top" },
          variant: "danger",
        })
        return
      }

      if ((state.created ?? 0) > 0) {
        onStep(
          {
            ...message,
            schedule: state.schedule,
            successfulMessagesCreated: state.created,
          },
          "next",
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit(new FormData(e.currentTarget))
      }}
    >
      <Stack direction='column' gap={defaultFormGap}>
        <Heading>{t("heading.main")}</Heading>
        <Paragraph>{t("hint.main")}</Paragraph>

        <Stack direction='row' gap={defaultFormGap}>
          <Radio
            name='scheduleWhen'
            id='now'
            value='now'
            label={t("label.now")}
            onChange={() => setSelectedSchedule("now")}
            checked={selectedSchedule === "now"}
          />

          <Radio
            name='scheduleWhen'
            id='future'
            value='future'
            label={t("label.later")}
            checked={selectedSchedule === "future"}
            onChange={() => setSelectedSchedule("future")}
          />
        </Stack>

        <Stack direction='row' gap={6}>
          <FormField
            error={
              dateTimeErrors.date ? { text: dateTimeErrors.date } : undefined
            }
            label={{ text: "Date", htmlFor: "scheduleDate" }}
          >
            <TextInput
              id='scheduleDate'
              name='scheduleDate'
              type='date'
              disabled={selectedSchedule !== "future"}
              onChange={() => {
                if (dateTimeErrors.date) {
                  setDateTimeErrors({})
                }
              }}
              min={today()}
            />
          </FormField>
          <FormField
            error={
              dateTimeErrors.time ? { text: dateTimeErrors.time } : undefined
            }
            label={{ text: "Time", htmlFor: "scheduleTime" }}
          >
            <TextInput
              id='scheduleTime'
              name='scheduleTime'
              type='time'
              disabled={selectedSchedule !== "future"}
              onChange={() => {
                if (dateTimeErrors.time) {
                  setDateTimeErrors({})
                }
              }}
            />
          </FormField>
        </Stack>

        <Button disabled={isSubmitting} type='submit'>
          {t("button.submit")}
          {isSubmitting && <Spinner />}
        </Button>

        <BackButton
          onClick={() => {
            onStep(message, "previous")
          }}
        >
          {t("button.back")}
        </BackButton>
      </Stack>
    </form>
  )
}
