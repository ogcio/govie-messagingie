import { type Static, Type } from "typebox";
import { WEBHOOKS_TAG } from "~/schemas/webhooks/logto-shared.js";

const NullableString = Type.Union([Type.String(), Type.Null()]);

export const LogtoUserCreatedSchema = {
  tags: [WEBHOOKS_TAG],
  operationId: "logtoUserCreated",
  body: Type.Object({
    hookId: Type.Optional(NullableString),
    event: Type.Optional(NullableString),
    sessionId: Type.Optional(NullableString),
    userAgent: Type.Optional(NullableString),
    ip: Type.Optional(NullableString),
    path: Type.Optional(NullableString),
    method: Type.Optional(NullableString),
    status: Type.Optional(Type.Number()),
    createdAt: Type.Optional(Type.String({ format: "date-time" })),
    data: Type.Object({
      id: Type.String(),
      username: NullableString,
      primaryEmail: Type.String({ format: "email" }),
      primaryPhone: Type.Optional(NullableString),
      name: Type.Optional(NullableString),
      avatar: Type.Optional(NullableString),
      customData: Type.Object({
        profileImportId: Type.Optional(NullableString),
        organizationId: Type.Optional(NullableString),
        insertPrivateDetails: Type.Optional(Type.Boolean()),
        onlyPrivateDetails: Type.Optional(Type.Boolean()),
      }),
      identities: Type.Record(
        Type.String(),
        Type.Object({
          details: Type.Object({
            email: Type.Optional(NullableString),
            rawData: Type.Record(
              Type.String(),
              Type.Union([
                Type.String(),
                Type.Null(),
                Type.Number(),
                Type.Boolean(),
                Type.Array(
                  Type.Union([
                    Type.String(),
                    Type.Null(),
                    Type.Boolean(),
                    Type.Number(),
                  ]),
                ),
              ]),
            ),
          }),
        }),
      ),
      lastSignInAt: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
      createdAt: Type.Optional(Type.Number()),
      updatedAt: Type.Optional(Type.Number()),
      profile: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      isSuspended: Type.Optional(Type.Boolean()),
      hasPassword: Type.Optional(Type.Boolean()),
    }),
    application: Type.Optional(
      Type.Object({ id: Type.Optional(NullableString) }),
    ),
    applicationId: Type.Optional(NullableString),
  }),
};

export type LogtoUserCreatedBody = Static<typeof LogtoUserCreatedSchema.body>;
