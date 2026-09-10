export type EmailData = string | { name?: string; email: string }

export type MailData = {
  to?: EmailData | EmailData[]
  cc?: EmailData | EmailData[]
  bcc?: EmailData | EmailData[]
  from: EmailData
  replyTo?: EmailData
  subject: string
  text?: string
  html?: string
}

export type MailDataRequired = MailData & ({ text: string } | { html: string })

export type Response<TPayload = object> = {
  statusCode: number
  body: TPayload
  // biome-ignore lint/suspicious/noExplicitAny: needed
  headers: any
}

export type SendEmail = (
  data: MailDataRequired | MailDataRequired[],
  // biome-ignore lint/complexity/noBannedTypes: to check
) => Promise<[undefined | Response, {}]>
