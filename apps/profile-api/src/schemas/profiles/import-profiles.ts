import { type Static, Type } from "typebox";
import { MimeTypes } from "~/const/mime-types.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxBooleanEnum, TypeboxStringEnum } from "~/types/typebox.js";
import { PROFILES_TAG } from "./constants.js";
import {
  KnownProfileDataDetailsSchema,
  PpsnOnlyProfileDataDetailsSchema,
} from "./model.js";

export const ImportProfilesImportTypesEnum = {
  PpsnOnly: "ppsn-only",
  Full: "full",
} as const;
export const ImportProfilesImportTypeSchema = TypeboxStringEnum([
  ImportProfilesImportTypesEnum.PpsnOnly,
  ImportProfilesImportTypesEnum.Full,
]);
export type ImportProfilesImportType = Static<
  typeof ImportProfilesImportTypeSchema
>;

export const ImportProfilesResponseSchema = Type.Object({
  status: Type.String(),
  profileImportId: Type.String(),
});

export const ImportProfileFromJsonSchema = Type.Array(
  KnownProfileDataDetailsSchema,
  { minItems: 1 },
);

export const ImportProfileFromJsonSchemaPpsnOnly = Type.Array(
  PpsnOnlyProfileDataDetailsSchema,
  { minItems: 1 },
);

const CsvFileSchema = Type.Any();

const ImportProfileBodySchema = Type.Object({
  profiles: Type.Optional(ImportProfileFromJsonSchema),
  ppsnOnlyProfiles: Type.Optional(ImportProfileFromJsonSchemaPpsnOnly),
  file: Type.Optional(CsvFileSchema),
});

export const ImportProfilesSchema = {
  consumes: [MimeTypes.Json, MimeTypes.FormData, MimeTypes.Csv],
  body: ImportProfileBodySchema,
  tags: [PROFILES_TAG],
  operationId: "importProfiles",
  querystring: Type.Object({
    privateDetails: Type.Optional(TypeboxBooleanEnum("false")),
    onlyPrivateDetails: Type.Optional(TypeboxBooleanEnum("false")),
    importType: Type.Optional(ImportProfilesImportTypeSchema),
  }),
  response: {
    200: ImportProfilesResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export const ImportProfilesOldSchema = {
  ...ImportProfilesSchema,
  deprecated: true,
  operationId: "importProfilesOld",
};
