import fs from "node:fs";
import { join } from "node:path";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import getVersion from "../../utils/get-version.js";

export default fp(
  async (fastify: FastifyInstance, _opts: FastifyPluginAsync) => {
    // Have to register the two plugins in the same file
    // because swaggerUi is dependent on Swagger
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: "OGCIO MessagingIE API",
          description: "API for OGCIO MessagingIE Service",
          version: await getVersion(),
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
    });

    // sanitize input
    // https://docs.bearer.com/reference/rules/javascript_lang_path_traversal/
    const logoPath = join(
      fastify.dirname.replace(/^(\.\.(\/|\\|$))+/, ""),
      "public",
      "logo.png",
    );

    fastify.register(fastifySwaggerUi, {
      routePrefix: "/docs",
      transformSpecificationClone: true,
      transformSpecification(swaggerObject) {
        // thanks to this we can avoid to remove endpoints
        // from the open api definition so to be able to use them
        // in the SDKs but at the same time hide them
        // in the Swagger UI
        delete swaggerObject.paths["/api/v1/user-imports/template-download"];
        return swaggerObject;
      },
      logo: {
        type: "image/png",
        content: Buffer.from(
          fs.readFileSync(logoPath).toString("base64"),
          "base64",
        ),
      },
    });
  },
  { name: "fastifySwagger" },
);
