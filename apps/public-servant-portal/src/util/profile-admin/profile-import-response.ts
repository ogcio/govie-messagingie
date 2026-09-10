export interface ProfileImportResponse {
  status?: string
  profileImportId?: string
}

export interface ProfileImportApiResponse {
  data?: ProfileImportResponse
  error?: { detail?: string }
}

/** Profile import POST returns `{ profileImportId, status }`; some clients wrap it in `{ data }`. */
export function getProfileImportIdFromResponse(
  json: ProfileImportApiResponse & ProfileImportResponse,
): string | undefined {
  return json.data?.profileImportId ?? json.profileImportId
}

export function getProfileImportErrorDetail(
  json: ProfileImportApiResponse,
  fallback: string,
): string {
  return json.error?.detail ?? fallback
}
