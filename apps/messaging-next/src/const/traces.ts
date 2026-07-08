export const TRACES = {
  CONFIRM_ACCOUNT_LINKING: "Confirm Account Linking",
}

export const TRACE_MESSAGES = {
  CONFIRM_ACCOUNT_LINKING: {
    SUCCESS: "Account linking confirmed",
    ERROR: "Account linking failed",
  },
  STALE_CLAIMS_REFRESH: {
    DETECTED: "Stale claims detected, forcing session refresh",
    SKIPPED_ALREADY_ATTEMPTED:
      "Stale claims still present after refresh attempt, falling through",
    INVALIDATE_FAILED: "Stale claims session invalidate call failed",
    RECOVERED: "Stale claims recovered, fresh onboarded session in use",
  },
  ATTACHMENT_DOWNLOAD: {
    ERROR: "Attachment download failed",
  },
  ATTACHMENT_METADATA: {
    MISSING: "Attachment metadata unavailable",
  },
}
