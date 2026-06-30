"use client"

import { Paragraph } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { SecureEmailViewer } from "./secure-email-viewer"
import styles from "./message-detail.module.css"

export interface MessageDetailBodyProps {
  richText?: string
  plainText?: string
  attachmentCount: number
}

export function hasMessageBody(richText?: string, plainText?: string): boolean {
  return Boolean(richText?.trim()) || Boolean(plainText?.trim())
}

export function MessageDetailBody({
  richText,
  plainText,
  attachmentCount,
}: MessageDetailBodyProps) {
  const t = useTranslations("home.detail")

  const showFallback =
    !hasMessageBody(richText, plainText) && attachmentCount > 0

  if (showFallback) {
    return (
      <Paragraph size='md' className={styles.fallbackText}>
        {t("attachmentOnlyFallback")}
      </Paragraph>
    )
  }

  if (richText?.trim()) {
    return <SecureEmailViewer content={richText} />
  }

  if (plainText?.trim()) {
    const paragraphs = plainText
      .trim()
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)

    return (
      <div className={styles.bodyText}>
        {paragraphs.map((paragraph, index) => (
          <p key={index} className={styles.bodyParagraph}>
            {paragraph}
          </p>
        ))}
      </div>
    )
  }

  return null
}
