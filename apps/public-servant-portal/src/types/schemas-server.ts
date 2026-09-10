"use server"
import { getTranslations } from "next-intl/server"
import { z } from "zod"
import {
  emailProviderContentShape,
  messageTemplateContentShape,
  sendMessageContentShape,
} from "./schemas"

const getMessageTemplateSchema = async () => {
  await getTranslations("formErrors.messageTemplate")

  return z.object({
    languages: z.array(z.string()),
    templateId: z.string().optional(),
  })
}

const getMessageTemplateContentSchema = async () => {
  const t = await getTranslations("formErrors.messageTemplate")

  return z.object({
    templateName: messageTemplateContentShape.templateName.min(1, {
      message: t("templateName"),
    }),
    richText: messageTemplateContentShape.richText,
    plainText: messageTemplateContentShape.plainText.min(1, {
      message: t("plainText"),
    }),
    subject: messageTemplateContentShape.subject.min(1, {
      message: t("subject"),
    }),
  })
}

const getCreateEmailProviderSchema = async () => {
  const t = await getTranslations("formErrors.emailProvider")

  return z.object({
    providerName: emailProviderContentShape.providerName.min(1, {
      message: t("name"),
    }),
    smtpHost: emailProviderContentShape.smtpHost.min(1, { message: t("host") }),
    smtpPort: emailProviderContentShape.smtpPort.min(1, { message: t("port") }),
    username: emailProviderContentShape.username.min(1, {
      message: t("username"),
    }),
    password: emailProviderContentShape.password.min(1, {
      message: t("password"),
    }),
    fromAddress: emailProviderContentShape.fromAddress
      .min(1, { message: t("fromAddress") })
      .email(t("invalidEmail")),
    throttle: emailProviderContentShape.throttle.optional(),
    ssl: emailProviderContentShape.ssl.default(false),
    isPrimary: emailProviderContentShape.isPrimary.default(false),
    headers: emailProviderContentShape.headers,
  })
}

const getUpdateEmailProviderSchema = async () => {
  const t = await getTranslations("formErrors.emailProvider")

  return z.object({
    id: emailProviderContentShape.id,
    providerName: emailProviderContentShape.providerName.min(1, {
      message: t("name"),
    }),
    smtpHost: emailProviderContentShape.smtpHost.min(1, { message: t("host") }),
    smtpPort: emailProviderContentShape.smtpPort.min(1, { message: t("port") }),
    username: emailProviderContentShape.username.min(1, {
      message: t("username"),
    }),
    password: emailProviderContentShape.password.optional(),
    fromAddress: emailProviderContentShape.fromAddress
      .min(1, { message: t("fromAddress") })
      .email(t("invalidEmail")),
    throttle: emailProviderContentShape.throttle.optional(),
    ssl: emailProviderContentShape.ssl.default(false),
    isPrimary: emailProviderContentShape.isPrimary.default(false),
    headers: emailProviderContentShape.headers,
  })
}

const getSendMessageSchema = async () => {
  const t = await getTranslations("formErrors.fields")

  return z.object({
    templateMetaId: sendMessageContentShape.templateMetaId.refine(
      (id) => Boolean(id),
      t("templateMetaId"),
    ),
    templateName: sendMessageContentShape.templateName.refine(
      (name) => Boolean(name),
      t("templateName"),
    ),
    userIds: sendMessageContentShape.userIds
      .transform((val) => val.split(","))
      .pipe(
        z.array(z.string()).min(1, {
          message: t("recipients"),
        }),
      ),
    schedule: sendMessageContentShape.schedule.refine(
      (name) => Boolean(name),
      t("templateName"),
    ),
    securityLevel: sendMessageContentShape.securityLevel,
  })
}

export {
  getCreateEmailProviderSchema,
  getMessageTemplateContentSchema,
  getMessageTemplateSchema,
  getSendMessageSchema,
  getUpdateEmailProviderSchema,
}
