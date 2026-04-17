const MessagePermissions = {
  Read: "messaging:message:read",
  Write: "messaging:message:write",
} as const;

const MessageOnboardingPermissions = {
  Read: "messaging:message.onboarding:read",
} as const;

const MessageSelfPermissions = {
  Read: "messaging:message.self:read",
  Write: "messaging:message.self:write",
} as const;

const ProviderPermissions = {
  Read: "messaging:provider:read",
  Write: "messaging:provider:write",
  Delete: "messaging:provider:delete",
} as const;

const TemplatePermissions = {
  Read: "messaging:template:read",
  Write: "messaging:template:write",
  Delete: "messaging:template:delete",
} as const;

const EventPermissions = {
  Read: "messaging:event:read",
} as const;

const SchedulerPermissions = {
  Write: "scheduler:jobs:write",
} as const;

const PlatformPermissions = {
  Read: "platform:messaging:read",
  Write: "platform:messaging:write",
} as const;

const OnboardedCitizenPermission = "profile:user:onboarded" as const;

export const Permissions = {
  Message: MessagePermissions,
  MessageOnboarding: MessageOnboardingPermissions,
  MessageSelf: MessageSelfPermissions,
  Provider: ProviderPermissions,
  Template: TemplatePermissions,
  Event: EventPermissions,
  Scheduler: SchedulerPermissions,
  Platform: PlatformPermissions,
  OnboardedCitizen: OnboardedCitizenPermission,
} as const;
