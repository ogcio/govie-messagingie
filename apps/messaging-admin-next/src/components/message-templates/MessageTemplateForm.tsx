"use client"
import {
  BreadcrumbCurrentLink,
  BreadcrumbLink,
  Breadcrumbs,
  Checkbox,
  Heading,
  Stack,
} from "@ogcio/design-system-react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { BackLink } from "@/components/BackButton"
import { LANG_EN, LANG_GA } from "@/types/shared"
import type { MessageTemplateFormData } from "@/types/types"
import { defaultFormGap } from "@/util/datetime"
import { ContentForm } from "./ContentForm"

export const MessageTemplateForm = ({
  templates,
}: {
  templates?: MessageTemplateFormData
}) => {
  const t = useTranslations("MessageTemplate")
  const locale = useLocale()
  const [languages, setlanguages] = useState<string[]>([])

  useEffect(() => {
    if (templates?.languages.length) {
      setlanguages(templates.languages)
    }
  }, [templates?.languages])

  const onChangeLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setlanguages(languages.filter((l) => l !== lang))
    } else {
      setlanguages((prev) => {
        if (lang === LANG_EN) {
          return [lang, ...prev]
        }
        return [...prev, lang]
      })
    }
  }

  return (
    <Stack direction='column' gap={defaultFormGap}>
      <Breadcrumbs>
        <BreadcrumbLink href={`/${locale}/message-templates`}>
          {t("templates")}
        </BreadcrumbLink>
        <BreadcrumbCurrentLink href=''>
          {templates?.templateId ? t("update") : t("create")}
        </BreadcrumbCurrentLink>
      </Breadcrumbs>

      <Heading>
        {templates?.templateId
          ? t("updateTemplateHeader")
          : t("createNewTemplateHeader")}
      </Heading>

      <Heading as='h2' size='sm'>
        {t("selectLanguagesHeading")}
      </Heading>
      {[LANG_EN, LANG_GA].map((lang: typeof LANG_EN | typeof LANG_GA) => (
        <Checkbox
          // biome-ignore lint/suspicious/noExplicitAny: Because DS
          size={"sm" as any}
          key={lang}
          id={lang}
          name={lang}
          onChange={() => onChangeLanguage(lang)}
          checked={languages.some((language) => language === lang)}
          value={`${lang} selector`}
          label={t(lang)}
        />
      ))}

      {languages.length ? (
        <ContentForm
          languages={languages}
          templates={templates}
          templateId={templates?.templateId}
        />
      ) : null}

      <BackLink href={`/${locale}/message-templates`}>{t("backLink")}</BackLink>
    </Stack>
  )
}
