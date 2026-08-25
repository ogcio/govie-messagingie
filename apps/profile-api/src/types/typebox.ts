import { type TObjectOptions, type TSchema, type TUnsafe, Type } from "typebox";
import Value from "typebox/value";

// `Type.Composite` was removed in typebox@1. The equivalent is evaluating an
// intersect, which flattens the members into a single object schema rather than
// emitting `allOf` (which Ajv treats differently under `removeAdditional`).
// Options belong on `Type.Evaluate`: passing them to `Type.Intersect` drops them.
const TypeboxComposite = <T extends TSchema[]>(
  schemas: [...T],
  options?: TObjectOptions,
) => Type.Evaluate(Type.Intersect(schemas), options);

const TypeboxStringEnum = <T extends string[]>(
  items: [...T],
  defaultValue?: string,
  description?: string,
) =>
  // NOTE: build a normal TypeBox string schema (no `~unsafe` runtime keyword)
  // and only cast at the TypeScript level to preserve the literal union type.
  // `Type.Unsafe(...)` would attach an own `~unsafe` property that Fastify
  // forwards to Ajv, which rejects it in strict mode as an unknown keyword.
  Type.String({
    enum: items,
    default: defaultValue,
    description,
  }) as unknown as TUnsafe<T[number]>;

export type AcceptedQueryBooleanValues = "true" | "false" | "0" | "1";

// Did this to allow boolean-like
// query parameters
const TypeboxBooleanEnum = (defaultValue?: string, description?: string) =>
  TypeboxStringEnum(["true", "false", "0", "1"], defaultValue, description);

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

const parseBooleanEnum = (inputValue: AcceptedQueryBooleanValues) =>
  Value.Decode(TypeboxBooleanEnumParser, inputValue);

export {
  parseBooleanEnum,
  TypeboxBooleanEnum,
  TypeboxBooleanEnumParser,
  TypeboxComposite,
  TypeboxStringEnum,
};
