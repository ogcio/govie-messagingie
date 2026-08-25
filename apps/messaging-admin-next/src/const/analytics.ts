export const ONBOARDING_CATEGORY = "onboarding"

export const ONBOARDING_ACTIONS = {
  ACCOUNT_LINKING: "account-linking",
  CONFIRM_ACCOUNT_LINKING: "confirm-account-linking",
  REPORT_ACCOUNT_LINKING: "report-account-linking",
}

export const OnboardingAnalyticsEvent = ({
  name,
  action,
}: {
  name: string
  action: string
}) => ({
  event: {
    category: ONBOARDING_CATEGORY,
    action,
    name,
    value: 1,
  },
})

export const ANALYTICS = {
  logs: {
    category: "Event Logs",
    adminEventLogsAll: {
      name: "event-logs-all",
      action: "Audit Log Viewed",
    },
    adminEventLogsDetail: {
      name: "event-logs-detail",
      action: "Individual Event Viewed",
    },
  },
  user: {
    category: "User",
    login: {
      name: "user-login",
      action: "Login",
    },
    logout: {
      name: "user-logout",
      action: "Logout",
    },
  },
  adminUser: {
    category: "Admin User",
    login: {
      name: "login",
      action: "Login",
    },
    logout: {
      name: "logout",
      action: "Logout",
    },
    view: {
      name: "dashboard-view",
      action: "Dashboard Viewed",
    },
  },
  engagement: {
    category: "Engagement",
    footer: {
      name: "footer-link-click",
      action: "Footer Link Followed",
    },
  },
  message: {
    category: "Message",
    access: {
      name: "message-session-start",
      action: "Time on Message",
    },
    back: {
      name: "message-back-click",
      action: "Return to List",
    },
    listView: {
      name: "message-list-view",
      action: "Message List Viewed",
    },
    detail: {
      name: "message-detail",
      action: "Message Opened",
    },
    attachmentDownload: {
      name: "message-attachment-download",
      action: "Attachment Downloaded",
    },
    stepInitial: {
      name: "message-step-initial",
      action: "Message type selected",
    },
    stepRecipients: {
      name: "message-step-recipients",
      action: "Message recipient manually selected",
    },
    stepAttachments: {
      name: "message-step-attachments",
      action: "Message attachments uploaded",
    },
    stepSchedule: {
      name: "message-step-schedule",
      action: "Message Scheduled",
    },
    stepComplete: {
      name: "message-step-complete",
      action: "Message send completed",
    },
  },
  template: {
    category: "Template",
    create: {
      name: "template-create",
      action: "Template Created",
    },
    edit: {
      name: "template-edit",
      action: "Template Edited",
    },
    preview: {
      name: "template-preview",
      action: "Template Previewed",
    },
    delete: {
      name: "template-delete",
      action: "Template Deleted",
    },
  },
  system: {
    category: "System",
    error: {
      name: "system-error",
      action: "Application Error",
    },
  },
}
