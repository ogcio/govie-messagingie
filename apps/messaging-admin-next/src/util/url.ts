import { DEFAULT_LOCALE } from "@/const"

export function url(locale: string) {
  const _locale = locale || DEFAULT_LOCALE
  return {
    home: `/${_locale}/send-a-message`,
    sendAMessage: `/${_locale}/send-a-message`,
    messageTemplates: {
      list: `/${_locale}/message-templates`,
      template: (id?: string) =>
        id
          ? `/${_locale}/message-templates/template?id=${encodeURIComponent(id)}`
          : `/${_locale}/message-templates/template`,
    },
    providers: {
      list: `/${_locale}/providers`,
      email: (id?: string) =>
        id
          ? `/${_locale}/providers/email?id=${encodeURIComponent(id)}`
          : `/${_locale}/providers/email`,
    },
    messageEvents: {
      list: `/${_locale}/message-events`,
      detail: (eventId: string, search?: string) => {
        const base = `/${_locale}/message-events/detail?eventId=${encodeURIComponent(eventId)}`
        return search ? `${base}&${search}` : base
      },
    },
    help: `/${_locale}/help`,
    inactivePublicServant: `/${_locale}/inactive-public-servant`,
  }
}
