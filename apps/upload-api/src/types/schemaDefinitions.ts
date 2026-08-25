import { type Static, type TSchema, type TUnsafe, Type } from "typebox";

export const Token = Type.Object({
  id_token: Type.String(),
  token_type: Type.String(),
  not_before: Type.Number(),
  id_token_expires_in: Type.Number(),
  profile_info: Type.String(),
  scope: Type.String(),
});

export type TokenType = Static<typeof Token>;

export const ResponseMetadata = Type.Object({
  fileName: Type.String(),
  id: Type.Optional(Type.String()),
  key: Type.String(),
  ownerId: Type.String(),
  fileSize: Type.Number(),
  mimeType: Type.String(),
  createdAt: Type.String(),
  lastScan: Type.String(),
  deleted: Type.Optional(Type.Boolean({ default: false })),
  infected: Type.Boolean(),
  infectionDescription: Type.Optional(Type.String()),
  antivirusDbVersion: Type.Optional(Type.String()),
  expiresAt: Type.Optional(Type.String()),
});

export type ResponseMetadataType = Static<typeof ResponseMetadata>;

export const getGenericResponseSchema = <T extends TSchema>(dataType: T) =>
  Type.Object({
    data: dataType,
  });

const DateType = Type.Object({
  getTime: Type.Function([], Type.Number()),
  toDateString: Type.Function([], Type.String()),
  toISOString: Type.Function([], Type.String()),
}) as unknown as TUnsafe<Date>;

export const FileMetadata = Type.Object({
  fileName: Type.String(),
  id: Type.Optional(Type.String()),
  key: Type.String(),
  ownerId: Type.String(),
  fileSize: Type.Number(),
  mimeType: Type.String(),
  createdAt: DateType,
  lastScan: DateType,
  deleted: Type.Optional(Type.Boolean({ default: false })),
  infected: Type.Boolean(),
  infectionDescription: Type.Optional(Type.String()),
  antivirusDbVersion: Type.Optional(Type.String()),
  organizationId: Type.Union([Type.String(), Type.Null()]),
  scheduledDeletionAt: Type.Optional(DateType),
  expiresAt: Type.Optional(DateType),
  externalId: Type.Optional(Type.String({ maxLength: 255 })),
});

export type Sharing = {
  fileId: string;
  userId: string;
};

export type FileMetadataType = Static<typeof FileMetadata>;
