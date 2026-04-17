import { join } from "node:path";
import fastifyAutoload from "@fastify/autoload";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import healthCheck from "./routes/healthcheck.js";
import routes from "./routes/index.js";

export default async function buildServer(
  app: FastifyInstance,
  options: FastifyPluginOptions,
) {
  app.decorate("dirname", import.meta.dirname);

  await app.register(fastifyAutoload, {
    dir: join(import.meta.dirname, "plugins/external"),
    options: { ...options },
  });

  await app.register(fastifyAutoload, {
    dir: join(import.meta.dirname, "plugins/internal"),
    options: { ...options },
  });

  app.register(healthCheck);

  app.register(routes, { prefix: "/api/v1" });
}
