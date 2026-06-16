import { PAGINATION_LIMIT_DEFAULT, PAGINATION_OFFSET_DEFAULT } from "@/const"

export const messagingApi = {
  templates: (search?: { search?: string; limit?: string }) => {
    const params = new URLSearchParams()
    if (search?.search) params.set("search", search.search)
    params.set("limit", search?.limit ?? "100")
    const qs = params.toString()
    return `/messaging/api/v1/templates${qs ? `?${qs}` : ""}`
  },
  template: (id: string) => `/messaging/api/v1/templates/${id}`,
  deleteTemplate: (id: string) => `/messaging/api/v1/templates/${id}`,
  deleteProvider: (id: string) =>
    `/messaging/api/v1/providers/${id}?type=email`,
  providers: (params?: { limit?: string; offset?: string }) => {
    const qs = new URLSearchParams({ type: "email" })
    if (params?.limit) qs.set("limit", params.limit)
    if (params?.offset) qs.set("offset", params.offset)
    return `/messaging/api/v1/providers?${qs.toString()}`
  },
  provider: (id: string) => `/messaging/api/v1/providers/${id}?type=email`,
  messageEvents: (params: {
    search?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    size?: number
    status?: string
  }) => {
    const qs = new URLSearchParams()
    const size = Math.max(1, params.size ?? PAGINATION_LIMIT_DEFAULT)
    const page = params.page ?? 0
    if (params.search) qs.set("search", params.search)
    if (params.dateFrom) qs.set("dateFrom", params.dateFrom)
    if (params.dateTo) qs.set("dateTo", params.dateTo)
    if (params.status) qs.set("status", params.status)
    qs.set("limit", String(size))
    qs.set("offset", String(page * size))
    return `/messaging/api/v1/message-events?${qs.toString()}`
  },
  messageEvent: (eventId: string) =>
    `/messaging/api/v1/message-events/${eventId}`,
  sendMessages: () => `/messaging/api/v1/messages`,
  selectProfiles: (ids: string, consentSubjects = "messaging") =>
    `/profile/api/v1/profiles/select-profiles?ids=${encodeURIComponent(ids)}&consentSubjects=${encodeURIComponent(consentSubjects)}`,
  profiles: (ids: string) =>
    `/profile/api/v1/profiles/select-profiles?ids=${encodeURIComponent(ids)}&consentSubjects=${encodeURIComponent("messaging")}`,
  profileSearch: (query: string) =>
    `/profile/api/v1/profiles/?search=${encodeURIComponent(query)}`,
  profileList: (params: {
    limit?: number
    offset?: number
    search?: string
    firstName?: string
    lastName?: string
    email?: string
    consentSubjects?: string
  }) => {
    const qs = new URLSearchParams()
    if (params.limit != null) qs.set("limit", String(params.limit))
    if (params.offset != null) qs.set("offset", String(params.offset))
    if (params.search) qs.set("search", params.search)
    if (params.firstName) qs.set("firstName", params.firstName)
    if (params.lastName) qs.set("lastName", params.lastName)
    if (params.email) qs.set("email", params.email)
    if (params.consentSubjects)
      qs.set("consentSubjects", params.consentSubjects)
    return `/profile/api/v1/profiles/?${qs.toString()}`
  },
  createProfile: () =>
    `/profile/api/v1/profiles/import-profiles?privateDetails=false`,
  createProvider: () => `/messaging/api/v1/providers?type=email`,
  updateProvider: (id: string) =>
    `/messaging/api/v1/providers/${id}?type=email`,
  uploadFile: () => `/upload/api/v1/files`,
  shareFile: () => `/upload/api/v1/permissions`,
  uploadMetadata: (id: string) => `/upload/api/v1/metadata/${id}`,
  downloadFile: (id: string) => `/upload/api/v1/files/${id}`,
}

export function pagingMeta(count: number, page: number, size: number) {
  const totalPages = Math.ceil(count / size) || 1
  const currentPage = Math.min(Math.max(0, page), totalPages - 1)
  return { totalPages, currentPage }
}

export { PAGINATION_OFFSET_DEFAULT }
