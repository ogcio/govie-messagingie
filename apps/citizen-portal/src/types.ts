export interface Message {
  id: string
  subject: string
  createdAt: string
  threadName: string | null
  organisationId: string
  recipientUserId: string
  excerpt?: string
  plainText?: string
  richText?: string
  /** May be omitted by messaging-public-api list responses */
  isSeen?: boolean
  securityLevel?: string
  /** Full attachment IDs -- present on the detail endpoint */
  attachments?: string[]
  /** Attachment count -- present on the list endpoint */
  attachmentsCount?: number
  /** Gateway metadata from messaging-public-api (includes journey submission link) */
  metadata?: {
    journey?: {
      submissionId: string
      journeyId?: string
    }
  } | null
}

export interface PaginatedMessages {
  data: Message[]
  metadata?: {
    totalCount?: number
  }
}

export interface FileMetadata {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  key: string
  ownerId: string
  createdAt: string
}

export interface MessageFilter {
  status: "all" | "read" | "unread"
  search?: string
  page: number
}

/** Localized string bag returned by the Journey-Builder external API. */
export interface LocalizedText {
  en: string
  ga?: string
}

/** Journey run status (`RunStatus` in the Journey-Builder schema). */
export type SubmissionStatus =
  | "initiated"
  | "submitted"
  | "processing"
  | "completed"
  | "cancelled"

/**
 * A user's Journey-Builder submission, as returned by
 * `GET /journey-builder/api/v1/external/user-submissions[/{id}]`.
 */
export interface Submission {
  id: string
  title: LocalizedText
  description: LocalizedText
  organizationId: string
  journeyId: string
  status: SubmissionStatus
  createdAt: string
  updatedAt: string
  submittedAt?: string
}
