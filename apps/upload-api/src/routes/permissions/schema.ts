import Type, { type Static } from "typebox";

export const AddPermissionsRequestBodySchema = Type.Union([
  Type.Object({
    fileId: Type.String(),
    userId: Type.String({ maxLength: 12 }),
  }),
  Type.Object({
    fileId: Type.String(),
    userIds: Type.Array(Type.String({ maxLength: 12 }), {
      minItems: 1,
    }),
  }),
]);

export type AddPermissionsRequestBody = Static<
  typeof AddPermissionsRequestBodySchema
>;
