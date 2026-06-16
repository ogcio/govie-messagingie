import { Tag } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"

export const MessageStatus = ({
  type,
  status,
}: {
  type: string
  status: string
}) => {
  const t = useTranslations("event.status")
  if (type === "message_delivery") {
    switch (status) {
      case "successful":
        return <Tag type='success' text={t("delivered")} />

      case "failed":
        return <Tag type='error' text={t("deliveredFailed")} />

      case "pending":
        return <Tag type='warning' text={t("delivering")} />
    }
  }

  if (type === "message_schedule") {
    switch (status) {
      case "successful":
        return <Tag type='info' text={t("scheduled")} />
      case "failed":
        return <Tag type='error' text={t("failed")} />
      case "pending":
        return <Tag type='info' text={t("delivering")} />
    }
  }

  if (type === "message_create") {
    switch (status) {
      case "successful":
        return <Tag type='default' text={t("created")} />
    }
  }

  if (type === "email_delivery") {
    switch (status) {
      case "successful":
        return <Tag type='success' text={t("delivered")} />
      case "failed":
        return <Tag type='error' text={t("deliveredFailed")} />
    }
  }

  if (type === "message_option_seen") {
    switch (status) {
      case "successful":
        return <Tag type='success' text={t("seen")} />
    }
  }

  if (type === "message_option_unseen") {
    switch (status) {
      case "successful":
        return <Tag type='success' text={t("unseen")} />
    }
  }

  return (
    <Tag type='default' text={`${type.replaceAll("_", " ")} (${status})`} />
  )
}
