/** biome-ignore-all lint/correctness/noUnusedVariables: Needed for exporting the RawRequest */
import type {
  FastifyLoggerInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerBase,
  RawServerDefault,
} from "fastify";

declare module "fastify" {
  export interface FastifyInstance<
    RawServer extends RawServerBase = RawServerDefault,
    RawRequest extends
      RawRequestDefaultExpression<RawServer> = RawRequestDefaultExpression<RawServer>,
    RawReply extends
      RawReplyDefaultExpression<RawServer> = RawReplyDefaultExpression<RawServer>,
    Logger = FastifyLoggerInstance,
  > {
    checkPermissions: (
      request: FastifyRequest,
      reply: FastifyReply,
      permissions: string[],
      matchConfig?: { method: "AND" | "OR" },
    ) => Promise<void>;
    dirname: string;
  }
}
