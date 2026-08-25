import { NodeCache } from "@cacheable/node-cache";
import type { FastifyInstance, FastifyServerOptions } from "fastify";
import fp from "fastify-plugin";
import type { JSONWebKeySet } from "jose";

type CacheableType = JSONWebKeySet | string | number | boolean | object;

declare module "fastify" {
  export interface FastifyInstance {
    nodeCache: NodeCache<CacheableType>;
  }
}

export default fp((fastify: FastifyInstance, _opts: FastifyServerOptions) => {
  fastify.decorate(
    "nodeCache",
    new NodeCache<CacheableType>({
      deleteOnExpire: true,
      stdTTL: 60 * 60 * 5, // 5 hours
      maxKeys: 100,
    }),
  );
});
