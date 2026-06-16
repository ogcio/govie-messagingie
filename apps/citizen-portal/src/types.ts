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
  isSeen: boolean
  securityLevel?: string
  /** Full attachment IDs -- present on the detail endpoint */
  attachments?: string[]
  /** Attachment count -- present on the list endpoint */
  attachmentsCount?: number
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
