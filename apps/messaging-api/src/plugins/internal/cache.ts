import { NodeCache } from "@cacheable/node-cache";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  export interface FastifyInstance {
    // biome-ignore lint/suspicious/noExplicitAny: We need the possibility to insert any type in there
    nodeCache: NodeCache<any>;
  }
}

export default fp((fastify: FastifyInstance, _opts: FastifyPluginAsync) => {
  fastify.decorate(
    "nodeCache",
    new NodeCache({
      deleteOnExpire: true,
      stdTTL: 60 * 60 * 5, // 5 hours
      maxKeys: 500,
    }),
  );
});
