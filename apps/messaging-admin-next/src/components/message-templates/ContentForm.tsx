"use client"

import {
  FormField,
  Heading,
  InputText,
  List,
  Paragraph,
  Stack,
  TextArea,
  toaster,
} from "@ogcio/design-system-react"
import { useGatewayMutation } from "@ogcio/sag-client/react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { type ChangeEventHandler, useEffect, useRef, useState } from "react"
import { z } from "zod"
import { SubmitButton } from "@/components/SubmitButton"
import { useOrganizationId } from "@/hooks/use-organization-id"
import { messageTemplateContentShape } from "@/types/schemas"
import { LANG_EN, LANG_GA } from "@/types/shared"
import type {
  MessageTemplateFormData,
  MessageTemplatePayload,
  MessageTemplatePayloadError,
} from "@/types/types"
import { messagingApi } from "@/util/api-paths"
import { defaultFormGap } from "@/util/datetime"

export const VALID_TEMPLATE_VARIABLES = ["publicName", "ppsn", "email"]

const templateMetaSchema = z.object({
  languages: z.array(z.string()).min(1),
  templateId: z.string().optional(),
})

const contentSchema = z.object(messageTemplateContentShape)

const ContentForm = (props: {
  languages?: string[]
  templates?: MessageTemplateFormData
  templateId?: string
}) => {
  const t = useTranslations("MessageTemplate")
  const router = useRouter()
  const organizationId = useOrganizationId()
  const headerMap: Record<string, string> = {
    [LANG_EN]: "English",
    [LANG_GA]: "Gaeilge",
  }

  const [errors, setErrors] = useState<
    Record<string, MessageTemplatePayloadError> & { api?: string }
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createPath = messagingApi.templates()
  const updatePath = props.templateId
    ? messagingApi.template(props.templateId)
    : null

  const { trigger: createTemplate } = useGatewayMutation<
    { id: string },
    { contents: MessageTemplatePayload[] }
  >(createPath, { method: "POST", organizationId })

  const { trigger: updateTemplate } = useGatewayMutation<
    unknown,
    { id: string; contents: MessageTemplatePayload[] }
  >(updatePath, { method: "PUT", organizationId })

  const loadedPropsToState = useRef(false)
  const [formState, setFormState] = useState<{
    [language: string]: {
      subject: string
      templateName: string
      richText: string
      plainText: string
    }
  }>({
    [LANG_EN]: {
      subject: "",
      plainText: "",
      richText: "",
      templateName: "",
    },
    [LANG_GA]: {
      subject: "",
      plainText: "",
      richText: "",
      templateName: "",
    },
  })

  useEffect(() => {
    if (!props.templates || loadedPropsToState.current) {
      return
    }

    loadedPropsToState.current = true
    setFormState({
      [LANG_EN]: props.templates.en ?? formState[LANG_EN],
      [LANG_GA]: props.templates.ga ?? formState[LANG_GA],
    })
  }, [props.templates, formState])

  const handleFormChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const { name, value } = e.target
    const [lang, key] = name.split("_")

    if (!name || !lang || !key) {
      return
    }

    setFormState((state) => ({
      ...state,
      [lang]: { ...state[lang], [key]: value },
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    const meta = templateMetaSchema.safeParse({
      languages: props.languages,
      templateId: props.templateId,
    })

    if (!meta.success) {
      setIsSubmitting(false)
      return
    }

    const { languages, templateId } = meta.data
    const contents: MessageTemplatePayload[] = []
    const fieldErrors: Record<string, MessageTemplatePayloadError> = {}

    for (const language of languages) {
      const parsed = contentSchema.safeParse({
        templateName:
          (
            e.currentTarget.elements.namedItem(
              `${language}_templateName`,
            ) as HTMLInputElement
          )?.value ?? formState[language]?.templateName,
        richText: formState[language]?.richText ?? "",
        plainText: formState[language]?.plainText ?? "",
        subject: formState[language]?.subject ?? "",
      })

      if (!parsed.success) {
        fieldErrors[language] = parsed.error.flatten().fieldErrors
        continue
      }

      contents.push({ language, ...parsed.data })
    }

    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors)
      setIsSubmitting(false)
      return
    }

    try {
      if (templateId) {
        await updateTemplate({ id: templateId, contents })
        router.push("./")
        return
      }

      const result = await createTemplate({ contents })
      router.push(`./?newid=${result.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : t("creationError")
      setErrors({ api: message })
      toaster.create({
        title: message,
        dismissible: true,
        duration: 10000,
        variant: "danger",
        position: { x: "right", y: "top" },
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack direction='column' gap={defaultFormGap}>
        <Paragraph>{t("interpolateHint")}</Paragraph>
        <Heading as='h2' size='sm'>
          {t("allowedVariablesHeading")}
        </Heading>

        <List
          items={VALID_TEMPLATE_VARIABLES.map((varName) => `{{${varName}}}`)}
        />

        {props.languages?.map((language) => {
          const error: MessageTemplatePayloadError | undefined =
            errors[language]

          return (
            <Stack key={language} direction='column' gap={defaultFormGap}>
              <Heading as='h3'>{headerMap[language]}</Heading>

              <FormField
                error={
                  error?.templateName && { text: error.templateName.join(", ") }
                }
                label={{
                  text: t("templateNameLabel"),
                  htmlFor: `${language}_templateName`,
                }}
              >
                <InputText
                  id={`${language}_templateName`}
                  name={`${language}_templateName`}
                  autoComplete='off'
                  defaultValue={
                    language === LANG_EN
                      ? props.templates?.en?.templateName
                      : language === LANG_GA
                        ? props.templates?.ga?.templateName
                        : undefined
                  }
                />
              </FormField>

              <FormField
                error={error?.subject && { text: error.subject.join(", ") }}
                label={{
                  text: t("subjectLabel"),
                  htmlFor: `${language}_subject`,
                }}
              >
                <TextArea
                  id={`${language}_subject`}
                  name={`${language}_subject`}
                  autoComplete='off'
                  value={formState[language].subject}
                  onChange={handleFormChange}
                />
              </FormField>

              <FormField
                error={error?.richText && { text: error.richText?.join(", ") }}
                label={{
                  text: t("richTextLabel"),
                  htmlFor: `${language}_richText`,
                }}
              >
                <TextArea
                  id={`${language}_richText`}
                  name={`${language}_richText`}
                  autoComplete='off'
                  value={formState[language].richText}
                  onChange={handleFormChange}
                  rows={15}
                />
              </FormField>

              <FormField
                error={
                  error?.plainText && { text: error.plainText?.join(", ") }
                }
                label={{
                  text: t("plainTextLabel"),
                  htmlFor: `${language}_plainText`,
                }}
              >
                <TextArea
                  id={`${language}_plainText`}
                  name={`${language}_plainText`}
                  autoComplete='off'
                  value={formState[language].plainText}
                  onChange={handleFormChange}
                  rows={15}
                />
              </FormField>
            </Stack>
          )
        })}
        <SubmitButton disabled={!props.languages?.length || isSubmitting}>
          {props.templateId ? t("update") : t("create")}
        </SubmitButton>
      </Stack>
    </form>
  )
}

export { ContentForm }
