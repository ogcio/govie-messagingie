"use client"

import {
  BreadcrumbCurrentLink,
  BreadcrumbLink,
  Breadcrumbs,
  Button,
  FormField,
  Heading,
  InputCheckbox,
  InputText,
  Spinner,
  Stack,
  toaster,
} from "@ogcio/design-system-react"
import { useGatewayMutation } from "@ogcio/sag-client/react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { z } from "zod"
import { BackLink } from "@/components/BackButton"
import { useOrganizationId } from "@/hooks/use-organization-id"
import type {
  EmailProviderApiPayload,
  EmailProviderPayloadError,
} from "@/types/types"
import { messagingApi } from "@/util/api-paths"
import { defaultFormGap } from "@/util/datetime"
import { url } from "@/util/url"

const headersSchema = z
  .union([
    z.null(),
    z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    z.string(),
  ])
  .optional()

function parseHeaders(
  raw: string,
): Record<string, unknown> | string | undefined {
  if (!raw || raw.trim().length === 0) {
    return undefined
  }
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>
    }
    return raw
  } catch {
    return raw
  }
}

const EmailProviderForm = ({
  provider,
}: {
  provider?: EmailProviderApiPayload & {
    smtpHost?: string
    smtpPort?: number
    ssl?: boolean
  }
}) => {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations("settings.EmailProvider")
  const tFormErrors = useTranslations("formErrors.emailProvider")
  const tCommons = useTranslations("Commons")
  const organizationId = useOrganizationId()
  const providersListUrl = url(locale).providers.list

  const createSchema = useMemo(
    () =>
      z.object({
        providerName: z.string().min(1, tFormErrors("name")),
        smtpHost: z.string().min(1, tFormErrors("host")),
        smtpPort: z.coerce.number().min(1, tFormErrors("port")),
        username: z.string().min(1, tFormErrors("username")),
        password: z.string().min(1, tFormErrors("password")),
        fromAddress: z
          .string()
          .min(1, tFormErrors("fromAddress"))
          .email(tFormErrors("invalidEmail")),
        throttle: z.coerce.number().optional(),
        ssl: z.boolean(),
        isPrimary: z.boolean(),
        headers: headersSchema,
        type: z.literal("email"),
      }),
    [tFormErrors],
  )

  const updateSchema = useMemo(
    () =>
      createSchema.extend({
        id: z.string().min(1),
        password: z.string().optional(),
      }),
    [createSchema],
  )

  const [errors, setErrors] = useState<
    EmailProviderPayloadError & { server?: string }
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { trigger: createProvider } = useGatewayMutation<
    { id: string },
    Record<string, unknown>
  >(messagingApi.createProvider(), { method: "POST", organizationId })

  const updatePath = provider?.id
    ? messagingApi.updateProvider(provider.id)
    : null

  const { trigger: updateProvider } = useGatewayMutation<
    { id: string },
    Record<string, unknown>
  >(updatePath, { method: "PUT", organizationId })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const headersRaw = formData.get("headers")?.toString() ?? ""
    const basePayload = {
      providerName: formData.get("providerName")?.toString() ?? "",
      smtpHost: formData.get("smtpHost")?.toString() ?? "",
      smtpPort: Number(formData.get("smtpPort")?.toString()),
      username: formData.get("username")?.toString() ?? "",
      password: formData.get("password")?.toString() ?? "",
      fromAddress: formData.get("fromAddress")?.toString() ?? "",
      throttle: Number(formData.get("throttle")?.toString()) || undefined,
      ssl: Boolean(formData.get("ssl")),
      isPrimary: Boolean(formData.get("isPrimary")),
      headers: parseHeaders(headersRaw),
      type: "email",
    }

    try {
      if (provider?.id) {
        const parsed = updateSchema.safeParse({
          ...basePayload,
          id: provider.id,
        })
        if (!parsed.success) {
          setErrors(parsed.error.flatten().fieldErrors)
          return
        }
        const { id, password, ...rest } = parsed.data
        await updateProvider({
          ...rest,
          id,
          type: "email",
          ...(password ? { password } : {}),
        })
        router.push(providersListUrl)
        return
      }

      const parsed = createSchema.safeParse(basePayload)
      if (!parsed.success) {
        setErrors(parsed.error.flatten().fieldErrors)
        return
      }

      await createProvider({
        ...parsed.data,
        headers: parsed.data.headers ?? null,
      })
      router.push(providersListUrl)
    } catch {
      const serverErrorMessage = t("error.server")
      setErrors({ server: serverErrorMessage })
      toaster.create({
        title: serverErrorMessage,
        position: {
          x: "right",
          y: "top",
        },
        variant: "danger",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Stack direction='column' gap={defaultFormGap}>
      <Breadcrumbs>
        <BreadcrumbLink href={`/${locale}/providers`}>
          {t("providers")}
        </BreadcrumbLink>
        <BreadcrumbCurrentLink href='/'>
          {provider?.id ? t("updateButton") : t("createButton")}
        </BreadcrumbCurrentLink>
      </Breadcrumbs>
      <Heading>{provider?.id ? t("titleUpdate") : t("titleAdd")}</Heading>

      <form
        onSubmit={handleSubmit}
        autoComplete='off'
        className='twelve-column-layout'
        style={{ width: "100%" }}
      >
        {errors.server ? (
          <FormField
            className='two-thirds-col-span new-grid-row'
            error={{ text: errors.server }}
          />
        ) : null}

        <FormField
          className='two-thirds-col-span'
          label={{ text: t("nameLabel"), htmlFor: "providerName" }}
          error={
            errors?.providerName
              ? { text: errors.providerName.join(", ") }
              : undefined
          }
        >
          <InputText
            id='providerName'
            name='providerName'
            autoComplete='off'
            defaultValue={provider?.providerName}
          />
        </FormField>

        <FormField
          className='two-thirds-col-span'
          label={{ text: t("fromAddressLabel"), htmlFor: "fromAddress" }}
          error={
            errors?.fromAddress
              ? { text: errors.fromAddress.join(", ") }
              : undefined
          }
        >
          <InputText
            id='fromAddress'
            name='fromAddress'
            autoComplete='off'
            defaultValue={provider?.fromAddress}
          />
        </FormField>

        <FormField
          className='two-thirds-col-span'
          label={{ text: t("hostLabel"), htmlFor: "smtpHost" }}
          error={
            errors?.smtpHost ? { text: errors.smtpHost.join(", ") } : undefined
          }
        >
          <InputText
            id='smtpHost'
            name='smtpHost'
            autoComplete='off'
            defaultValue={provider?.smtpHost ?? provider?.host}
          />
        </FormField>

        <FormField
          className='two-thirds-col-span'
          label={{ text: t("portLabel"), htmlFor: "smtpPort" }}
          error={
            errors?.smtpPort ? { text: errors.smtpPort.join(", ") } : undefined
          }
        >
          <InputText
            id='smtpPort'
            name='smtpPort'
            autoComplete='off'
            defaultValue={String(provider?.smtpPort ?? provider?.port ?? "")}
          />
        </FormField>

        <FormField className='two-thirds-col-span'>
          <InputCheckbox
            id='ssl'
            name='ssl'
            value='ssl'
            defaultChecked={provider?.ssl ?? true}
            label={t("ssl")}
          />
        </FormField>

        <FormField className='two-thirds-col-span'>
          <InputCheckbox
            id='isPrimary'
            name='isPrimary'
            value='isPrimary'
            defaultChecked={provider?.isPrimary}
            label={t("isPrimary")}
          />
        </FormField>

        <FormField
          className='two-thirds-col-span'
          label={{ text: t("usernameLabel"), htmlFor: "username" }}
          error={
            errors?.username ? { text: errors.username.join(", ") } : undefined
          }
        >
          <InputText
            id='username'
            name='username'
            autoComplete='off'
            defaultValue={provider?.username}
          />
        </FormField>

        <FormField
          className='two-thirds-col-span'
          label={{
            text: provider?.id ? t("updatePasswordLabel") : t("passwordLabel"),
            htmlFor: "password",
          }}
          error={
            errors?.password ? { text: errors.password.join(", ") } : undefined
          }
        >
          <InputText
            id='password'
            type='password'
            name='password'
            autoComplete='off'
          />
        </FormField>

        <FormField
          className='two-thirds-col-span'
          label={{ text: t("headersLabel"), htmlFor: "headers" }}
          error={
            errors?.headers ? { text: errors.headers.join(", ") } : undefined
          }
        >
          <InputText
            id='headers'
            type='text'
            name='headers'
            autoComplete='off'
            defaultValue={
              provider && "headers" in provider && provider.headers
                ? JSON.stringify(provider.headers)
                : ""
            }
          />
        </FormField>

        <Button type='submit' className='new-grid-row' disabled={isSubmitting}>
          {provider ? t("updateButton") : t("createButton")}
          {isSubmitting ? <Spinner /> : null}
        </Button>
      </form>
      <BackLink href={`/${locale}/providers`}>{tCommons("backLink")}</BackLink>
    </Stack>
  )
}

export { EmailProviderForm }
