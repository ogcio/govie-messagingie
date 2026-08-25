enum UploadPermissions {
  Read = "upload:file:read",
  Write = "upload:file:write",
}

enum UploadSelfPermissions {
  Read = "upload:file.self:read",
  Write = "upload:file.self:write",
}

enum UploadPlatformPermissions {
  Read = "platform:upload:read",
  Write = "platform:upload:write",
}

export const Permissions = {
  UploadSelf: UploadSelfPermissions,
  Upload: UploadPermissions,
  Platform: UploadPlatformPermissions,
};
