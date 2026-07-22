import type { Message } from "@/types"

/**
 * Related-message fixtures for mock-only flows. Production path uses
 * messaging-public-api (`GET /api/v1/citizens/messages?submissionId=...`).
 * Kept separate from `messages.json`; ids are registered with
 * `findMockMessageById` so detail links remain browsable in mock mode.
 */
export const RELATED_MESSAGES_ENABLED: boolean =
  process.env.NEXT_PUBLIC_ENABLE_MOCK_MESSAGES === "true" ||
  process.env.NEXT_PUBLIC_ENABLE_LEA === "true"

/**
 * Submission-scoped message fixtures for the LEA application detail
 * "Related messages" list. Kept separate from `messages.json` until the
 * messaging API exposes a submission filter; ids are registered with
 * `findMockMessageById` so detail links remain browsable in mock mode.
 */
export const RELATED_MESSAGES_BY_SUBMISSION: Record<string, Message[]> = {
  /** Local journey seed: scripts/seed-local-peter-parker-submissions.sql */
  PPMG0004: [
    {
      id: "rel-ppm-g004-received",
      subject: "Driving licence renewal application received",
      createdAt: "2026-07-14T08:00:00Z",
      threadName: "Department of Transport",
      organisationId: "ogcio",
      recipientUserId: "ts75kydtaqn4",
      excerpt: "We have received your driving licence renewal application.",
      isSeen: false,
      attachmentsCount: 0,
      plainText:
        "We have received your driving licence renewal application and it is now being reviewed.",
    },
    {
      id: "rel-ppm-g004-docs",
      subject: "Additional documents required",
      createdAt: "2026-07-13T14:30:00Z",
      threadName: "Department of Transport",
      organisationId: "ogcio",
      recipientUserId: "ts75kydtaqn4",
      excerpt: "Please upload a recent proof-of-address document.",
      isSeen: true,
      attachmentsCount: 0,
      plainText:
        "Please upload a recent proof-of-address document to continue processing your application.",
    },
  ],
  PPMG0003: [
    {
      id: "rel-ppm-g003-completed",
      subject: "Birth registration completed",
      createdAt: "2026-07-04T16:20:00Z",
      threadName: "The General Register Office",
      organisationId: "ogcio",
      recipientUserId: "ts75kydtaqn4",
      excerpt: "Your birth registration has been completed.",
      isSeen: true,
      attachmentsCount: 1,
      attachments: ["1000000e-0000-4000-8000-0000000000e1"],
      plainText:
        "Your birth registration has been completed. Your certificate will be posted shortly.",
    },
  ],
  "SCH-2025-084321": [
    {
      id: "rel-sch-084321-approved",
      subject: "School placement registration approved",
      createdAt: "2026-04-20T14:30:00Z",
      threadName: "Dept of Education Schools Application Team",
      organisationId: "org-doe",
      recipientUserId: "user-001",
      excerpt:
        "Your school placement registration for Marie has been approved.",
      isSeen: false,
      attachmentsCount: 1,
      attachments: ["1000000f-0000-4000-8000-0000000000f1"],
      plainText:
        "Your school placement registration for Marie has been approved. No further action is required.",
    },
    {
      id: "rel-sch-084321-received",
      subject: "School placement registration received",
      createdAt: "2026-04-17T09:10:00Z",
      threadName: "Dept of Education Schools Application Team",
      organisationId: "org-doe",
      recipientUserId: "user-001",
      excerpt: "We have received your school placement registration.",
      isSeen: true,
      attachmentsCount: 0,
      plainText:
        "We have received your school placement registration and it is now being reviewed.",
    },
  ],
  "SCH-2025-095478": [
    {
      id: "rel-sch-095478-received",
      subject: "Social housing application received",
      createdAt: "2026-02-11T11:20:00Z",
      threadName: "Wicklow County Council",
      organisationId: "org-wicklow",
      recipientUserId: "user-001",
      excerpt: "Your social housing application has been received.",
      isSeen: true,
      attachmentsCount: 0,
      plainText:
        "Your social housing application has been received and added to the assessment queue.",
    },
  ],
  "SCH-2025-073296": [
    {
      id: "rel-sch-073296-completed",
      subject: "Birth registration completed",
      createdAt: "2026-01-18T16:20:00Z",
      threadName: "The General Register Office",
      organisationId: "org-gro",
      recipientUserId: "user-001",
      excerpt: "The birth registration has been completed.",
      isSeen: true,
      attachmentsCount: 1,
      attachments: ["1000000e-0000-4000-8000-0000000000e1"],
      plainText:
        "The birth registration has been completed. Your birth certificate is enclosed.",
    },
  ],
}

const ALL_RELATED_MOCKS: Message[] = RELATED_MESSAGES_ENABLED
  ? Object.values(RELATED_MESSAGES_BY_SUBMISSION).flat()
  : []

export function getMockRelatedMessages(submissionId: string): Message[] {
  if (!RELATED_MESSAGES_ENABLED) return []
  return RELATED_MESSAGES_BY_SUBMISSION[submissionId] ?? []
}

export function findMockRelatedMessageById(id: string): Message | null {
  if (!RELATED_MESSAGES_ENABLED) return null
  return ALL_RELATED_MOCKS.find((message) => message.id === id) ?? null
}

export function findMockSubmissionIdForRelatedMessage(
  messageId: string,
): string | null {
  if (!RELATED_MESSAGES_ENABLED) return null
  for (const [submissionId, messages] of Object.entries(
    RELATED_MESSAGES_BY_SUBMISSION,
  )) {
    if (messages.some((message) => message.id === messageId)) {
      return submissionId
    }
  }
  return null
}
