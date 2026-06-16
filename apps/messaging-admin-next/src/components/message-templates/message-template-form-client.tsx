"use client"

import { useGatewayFetch } from "@ogcio/sag-client/react"
import { useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { MessageTemplateForm } from "@/components/message-templates/MessageTemplateForm"
import { LANG_EN, LANG_GA } from "@/types/shared"
import type { MessageTemplateFormData } from "@/types/types"
import { messagingApi } from "@/util/api-paths"

type TemplateResponse = {
  contents: Array<{
    language: string
    subject: string
    plainText: string
    richText?: string
    templateName: string
  }>
}

export function MessageTemplateFormClient() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get("id")

  const { data } = useGatewayFetch<TemplateResponse>(
    templateId ? messagingApi.template(templateId) : null,
  )

  const templates: MessageTemplateFormData = useMemo(() => {
    const base: MessageTemplateFormData = {
      languages: [],
      // Single-template GET returns contents only; id comes from the URL (legacy parity).
      templateId: templateId ?? undefined,
    }
    if (!data) return base

    const result = {
      ...base,
      templateId: templateId ?? undefined,
      languages: [] as string[],
    }
    for (const item of data.contents) {
      const lang = item.language === LANG_GA ? LANG_GA : LANG_EN
      result[lang] = {
        subject: item.subject,
        plainText: item.plainText,
        richText: item.richText ?? "",
        templateName: item.templateName,
      }
      result.languages.push(lang)
    }
    return result
  }, [data, templateId])

  return <MessageTemplateForm templates={templates} />
}
