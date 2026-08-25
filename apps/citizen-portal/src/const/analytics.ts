/**
 * Matomo event catalogue for citizen-portal.
 * Mirrors apps/messaging-admin-next/src/const/analytics.ts so the two
 * surfaces are comparable side-by-side. Names/categories shared with the
 * admin app (message-list-view, message-detail, system-error, user-login)
 * are intentional.
 */
export const ANALYTICS = {
  message: {
    category: "Message",
    listView: { name: "message-list-view", action: "Message List Viewed" },
    detail: { name: "message-detail", action: "Message Opened" },
    back: { name: "message-back-click", action: "Return to List" },
    attachmentDownload: {
      name: "message-attachment-download",
      action: "Attachment Downloaded",
    },
    attachmentError: {
      name: "message-attachment-download-error",
      action: "Attachment Unavailable",
    },
  },
  user: {
    category: "User",
    login: { name: "user-login", action: "Login" },
  },
  consent: {
    category: "Consent",
    accepted: { name: "consent-accepted", action: "Consent Accepted" },
    declined: { name: "consent-declined", action: "Consent Declined" },
  },
  profile: {
    category: "Profile",
    consentChange: {
      name: "profile-consent-change",
      action: "Consent Change Initiated",
    },
    exportRequested: {
      name: "export-requested",
      action: "Data Export Requested",
    },
    exportRequestError: {
      name: "export-request-error",
      action: "Data Export Request Failed",
    },
    exportDownloaded: {
      name: "export-downloaded",
      action: "Data Export Downloaded",
    },
  },
  system: {
    category: "System",
    error: { name: "system-error", action: "Application Error" },
  },
} as const
