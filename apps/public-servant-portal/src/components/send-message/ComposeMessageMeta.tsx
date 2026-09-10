"use client"

import {
  Details,
  FormField,
  Heading,
  Link,
  Paragraph,
  Radio,
  Select,
  SelectItem,
  Stack,
} from "@ogcio/design-system-react"
import { useAnalytics } from "@ogcio/nextjs-analytics"
import { useGatewayFetch } from "@ogcio/sag-client/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useContext, useEffect, useMemo, useState } from "react"
import { SubmitButton } from "@/components/SubmitButton"
import { ANALYTICS } from "@/const/analytics"
import { MessageSecurityLevel } from "@/const/messaging"
import type { TemplateContent, TemplateOptionApiPayload } from "@/types/types"
import { messagingApi } from "@/util/api-paths"
import { defaultFormGap } from "@/util/datetime"
import { SendMessageContext } from "./SendMessageContext"

type TemplateDetailResponse = {
  contents: TemplateContent[]
}

export default function ComposeMessageMeta() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const analyticsClient = useAnalytics()
  const locale = useLocale()
  const t = useTranslations("message.wizard.step.meta")
  const { message, onStep } = useContext(SendMessageContext)

  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [readyToRenderTemplate, setReadyToRenderTemplate] = useState(false)

  useEffect(() => {
    analyticsClient.trackEvent({
      event: {
        name: ANALYTICS.message.stepInitial.name,
        category: ANALYTICS.message.category,
        action: ANALYTICS.message.stepInitial.action,
      },
    })
  }, [analyticsClient])

  const { data: templateOptions, isLoading: templatesLoading } =
    useGatewayFetch<TemplateOptionApiPayload[]>(
      messagingApi.templates({ limit: "100" }),
    )

  const initialTemplateId = useMemo(() => {
    if (!templateOptions?.length) return ""
    return (
      templateOptions.find((o) => o.id === searchParams.get("templateId"))
        ?.id ||
      templateOptions.at(0)?.id ||
      ""
    )
  }, [templateOptions, searchParams])

  useEffect(() => {
    if (initialTemplateId && !selectedTemplate) {
      setSelectedTemplate(initialTemplateId)
    }
  }, [initialTemplateId, selectedTemplate])

  const templatePath = selectedTemplate
    ? messagingApi.template(selectedTemplate)
    : null

  const { data: templateDetail, isLoading: templateLoading } =
    useGatewayFetch<TemplateDetailResponse>(templatePath)

  const lang = locale

  useEffect(() => {
    if (!templateOptions?.length || templatesLoading) return
    if (!selectedTemplate && initialTemplateId) {
      setSelectedTemplate(initialTemplateId)
    }
    // Strip query string (e.g. `?templateId=...`) once consumed, but only when
    // there is something to strip. Calling `router.replace(pathname)` on a URL
    // that already has no query causes a full document reload under
    // `output: "export"` + the `history.replaceState` patch from
    // `@ogcio/nextjs-analytics`, putting this page in a reload loop.
    if (searchParams.toString()) {
      router.replace(pathname)
    }
    setReadyToRenderTemplate(true)
  }, [
    templateOptions?.length,
    templatesLoading,
    selectedTemplate,
    initialTemplateId,
    router,
    pathname,
    searchParams,
  ])

  useEffect(() => {
    if (templateLoading) {
      setReadyToRenderTemplate(false)
    } else if (templateDetail) {
      setReadyToRenderTemplate(true)
    }
  }, [templateLoading, templateDetail])

  const activeContent = useMemo(() => {
    if (!templateDetail?.contents?.length) return undefined
    return (
      templateDetail.contents.find((c) => c.language === lang) ??
      templateDetail.contents.at(0)
    )
  }, [templateDetail, lang])

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const templateMetaId = formData.get("templateMetaId")?.toString() || ""
    const templateName =
      templateOptions
        ?.find((o) => o.id === templateMetaId)
        ?.contents?.find((c) => c.language === lang)?.templateName || ""

    message.securityLevel =
      (formData.get("securityLevel") as MessageSecurityLevel) ||
      MessageSecurityLevel.CONFIDENTIAL

    onStep(
      {
        ...message,
        templateName,
        templateMetaId,
      },
      "next",
    )
  }

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTemplate(e.target.value)
    setReadyToRenderTemplate(false)
  }

  const canSubmit = Boolean(
    templateOptions?.length && lang && readyToRenderTemplate && activeContent,
  )

  if (templatesLoading && !templateOptions?.length) {
    return null
  }

  return (
    <form onSubmit={handleFormSubmit}>
      <Stack direction='column' gap={defaultFormGap}>
        <Heading>{t("heading.main")}</Heading>

        <Paragraph>
          {t.rich("paragraph.main", {
            href: (chunks) => (
              <Link href={`/${locale}/message-templates`}>{chunks}</Link>
            ),
          })}
        </Paragraph>

        <FormField
          label={{ text: t("heading.type"), htmlFor: "securityLevel" }}
        >
          <Stack direction='column' gap={2}>
            <Paragraph>{t("paragraph.type")}</Paragraph>
            <Stack direction='row' gap={2}>
              <Radio
                name='securityLevel'
                value={MessageSecurityLevel.CONFIDENTIAL}
                label={t("label.secure")}
                defaultChecked={true}
              />
              <Radio
                name='securityLevel'
                value={MessageSecurityLevel.PUBLIC}
                label={t("label.nonSecure")}
              />
            </Stack>
          </Stack>
        </FormField>
        <Details label={t("label.security")}>{t("details.security")}</Details>

        <FormField
          label={{ text: t("label.template"), htmlFor: "template-select" }}
        >
          <Select
            id='template-select'
            name='templateMetaId'
            onChange={handleTemplateSelect}
            value={selectedTemplate || undefined}
          >
            {templateOptions?.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.contents.find((content) => content.language === lang)
                  ?.templateName || template.contents.at(0)?.templateName}
              </SelectItem>
            ))}
          </Select>
        </FormField>

        {readyToRenderTemplate && activeContent && (
          <Stack direction={"column"} gap={defaultFormGap}>
            <div>
              <Heading as='h2'>{t("heading.subject")}</Heading>
              <Paragraph>{activeContent.subject}</Paragraph>
            </div>

            <div>
              <Heading as='h2'>{t("heading.plainText")}</Heading>
              <Paragraph whitespace='break-spaces'>
                {activeContent.plainText}
              </Paragraph>
            </div>

            {activeContent.richText && (
              <div>
                <Heading as='h2'>{t("heading.richText")}</Heading>
                <Paragraph whitespace='break-spaces'>
                  {activeContent.richText}
                </Paragraph>
              </div>
            )}
          </Stack>
        )}

        <SubmitButton disabled={!canSubmit}>{t("button.submit")}</SubmitButton>
      </Stack>
    </form>
  )
}
