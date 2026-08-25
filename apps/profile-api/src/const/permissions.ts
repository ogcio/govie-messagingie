export const UserPermissions = {
  Read: "profile:user:read",
  Write: "profile:user:write",
};

export const UserSelfPermissions = {
  Read: "profile:user.self:read",
  Write: "profile:user.self:write",
};

export const UserAdminPermissions = {
  Read: "profile:user.admin:read",
  Write: "profile:user.admin:write",
};

export const UserOnboardingPermissions = {
  Read: "profile:user.onboarding:read",
};

export const PlatformPermissions = {
  Write: "platform:profile:write",
  Read: "platform:profile:read",
};

export const Permissions = {
  User: UserPermissions,
  UserSelf: UserSelfPermissions,
  UserAdmin: UserAdminPermissions,
  UserOnboarding: UserOnboardingPermissions,
  Platform: PlatformPermissions,
};
