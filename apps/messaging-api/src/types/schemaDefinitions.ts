import { type Static, type TSchema, Type } from "typebox";
import Value from "typebox/value";

export const PAGINATION_OFFSET_DEFAULT = 0;
export const PAGINATION_LIMIT_DEFAULT = 20;
export const PAGINATION_MAX_LIMIT = 100;
export const PAGINATION_MIN_LIMIT = 1;
export const PAGINATION_MIN_OFFSET = 0;

export type AvailableLanguages = "en" | "ga";
export const AVAILABLE_LANGUAGES = ["en", "ga"];
export const DEFAULT_LANGUAGE = "en";

export const TypeboxStringEnum = <T extends string[]>(
  items: [...T],
  defaultValue?: string,
  description?: string,
) =>
  Type.Unsafe<T[number]>({
    type: "string",
    enum: items,
    default: defaultValue,
    description,
  });

export type AcceptedQueryBooleanValues = "true" | "false" | "0" | "1";

// Did this to allow boolean-like
// query parameters
export const TypeboxBooleanEnum = (
  defaultValue?: string,
  description?: string,
) => TypeboxStringEnum(["true", "false", "0", "1"], defaultValue, description);

const TypeboxBooleanEnumParser = Type.Codec(
  Type.Union([
    Type.Literal("true"),
    Type.Literal("false"),
    Type.Literal("0"),
    Type.Literal("1"),
  ]),
)
  .Decode(
    (stringValue: AcceptedQueryBooleanValues) =>
      stringValue === "true" || stringValue === "1",
  )
  .Encode((boolVal: boolean) => {
    return boolVal ? "true" : "false";
  });

export const parseBooleanEnum = (inputValue: AcceptedQueryBooleanValues) =>
  Value.Decode(TypeboxBooleanEnumParser, inputValue);

export const TemplateInputSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  interpolations: Type.Record(Type.String(), Type.String()),
});
export type TemplateInput = Static<typeof TemplateInputSchema>;

export const PaginationParamsSchema = Type.Object({
  offset: Type.Optional(
    Type.String({
      pattern: "^[0-9][0-9]*|undefined$",
      default: PAGINATION_MIN_OFFSET.toString(),
      description:
        "Indicates where to start fetching data or how many records to skip, defining the initial position within the list",
    }),
  ),
  limit: Type.Optional(
    Type.String({
      default: PAGINATION_LIMIT_DEFAULT.toString(),
      pattern: `^([1-9]|${PAGINATION_MAX_LIMIT})|undefined$`,
      description: `Indicates the maximum number (${PAGINATION_MAX_LIMIT}) of items that will be returned in a single request`,
    }),
  ),
});

export type PaginationParams = Static<typeof PaginationParamsSchema>;

export const getPaginationLinkSchema = (description?: string) =>
  Type.Object({
    href: Type.Optional(Type.String({ description })),
  });

export const PaginationLinksSchema = Type.Object(
  {
    self: getPaginationLinkSchema("URL pointing to the request itself"),
    next: Type.Optional(
      getPaginationLinkSchema(
        "URL pointing to the next page of results in a paginated response. If there are no more results, this field may be omitted",
      ),
    ),
    prev: Type.Optional(
      getPaginationLinkSchema(
        "URL pointing to the previous page of results in a paginated response. If there are no more results, this field may be omitted",
      ),
    ),
    first: getPaginationLinkSchema(
      "URL pointing to the first page of results in a paginated response",
    ),
    last: getPaginationLinkSchema(
      "URL pointing to the first page of results in a paginated response",
    ),
    pages: Type.Record(Type.String(), getPaginationLinkSchema(), {
      description:
        "It may contain a list of other useful URLs, e.g. one entry for page:'page 1', 'page 2'",
    }),
  },
  { description: "Object containing the links to the related endpoints" },
);

export type PaginationLinks = Static<typeof PaginationLinksSchema>;

export const ResponseMetadataSchema = Type.Optional(
  Type.Object({
    links: Type.Optional(PaginationLinksSchema),
    totalCount: Type.Optional(
      Type.Number({
        description: "Number representing the total number of available items",
      }),
    ),
  }),
);

export const getGenericResponseSchema = <T extends TSchema>(dataType: T) =>
  Type.Object({
    data: dataType,
    metadata: ResponseMetadataSchema,
  });

export type GenericResponse<T> = {
  data: T;
  metadata?: Static<typeof ResponseMetadataSchema>;
};
