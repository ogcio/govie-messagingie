import fs from "node:fs";
import { join } from "node:path";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { getPackageInfo } from "~/utils/get-package-info.js";

export default fp(
  async (fastify: FastifyInstance, opts: FastifyPluginAsync) => {
    // Have to register the two plugins in the same file
    // because swaggerUi is dependent on Swagger
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: "Life Events Profile API",
          description: "API for Life Events Profile Service",
          version: (await getPackageInfo()).version,
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      ...opts,
    });
    fastify.register(fastifySwaggerUi, {
      routePrefix: "/docs",
      logo: {
        type: "image/png",
        content: Buffer.from(
          fs
            .readFileSync(join(fastify.dirname, "public", "logo.png"))
            .toString("base64"),
          "base64",
        ),
      },
      ...opts,
    });
  },
  { name: "fastifySwagger" },
);
