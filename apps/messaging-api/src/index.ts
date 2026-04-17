import { writeFile } from "node:fs/promises";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { getLoggingConfiguration } from "@ogcio/fastify-logging-wrapper";
import { type FastifyInstance, fastify } from "fastify";
import type { PinoLoggerOptions } from "fastify/types/logger.js";
import fp from "fastify-plugin";
import buildServer from "./app.js";

const writeOpenApiDefinition = async (app: FastifyInstance) => {
  try {
    await writeFile("./openapi-definition.yml", app.swagger({ yaml: true }));
  } catch (e) {
    app.log.warn(e, "Error writing open api definition file");
  }
};

const server = fastify({
  ...getLoggingConfiguration({
    additionalLoggerConfigs: {
      level: (process.env.LOG_LEVEL ?? "debug") as PinoLoggerOptions["level"],
    },
  }),
  ajv: {
    customOptions: {
      coerceTypes: false,
      removeAdditional: "all",
    },
  },
}).withTypeProvider<TypeBoxTypeProvider>();

server.register(fp(buildServer));
await server.ready();

server.listen({ host: "0.0.0.0", port: 8002 }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});

await writeOpenApiDefinition(server);
