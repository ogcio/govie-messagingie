export type ApiProfileUser = {
  id: string
  email: string
  publicName?: string
  preferredLanguage?: "en" | "ga"
  updatedAt?: string
  details?: {
    ppsn?: string
    firstName?: string
    lastName?: string
  }
}

export type PaginationMetadata = {
  totalCount?: number
}

export type ApiServiceUserImportProfileDetail = {
  email?: string
  firstName?: string
  lastName?: string
  status?: string
}

export type ApiServiceUserImport = {
  id: string
  metadata?: { filename?: string }
  createdAt: string
  status: string
}

export type ApiServiceUserProfileImport = {
  metadata?: { filename?: string }
  createdAt?: string
  status?: string
  details?: ApiServiceUserImportProfileDetail[]
}
