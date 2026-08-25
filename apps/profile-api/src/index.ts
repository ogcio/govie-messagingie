import { writeFile } from "node:fs/promises";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { getLoggingConfiguration } from "@ogcio/fastify-logging-wrapper";
import fastify, { type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import buildServer from "./server.js";

const writeOpenApiDefinition = async (app: FastifyInstance) => {
  try {
    await writeFile("./openapi-definition.yml", app.swagger({ yaml: true }));
  } catch (e) {
    app.log.warn(e, "Error writing open api definition file");
  }
};

const server = fastify({
  ...getLoggingConfiguration({
    additionalLoggerConfigs: { level: process.env.LOG_LEVEL ?? "debug" },
  }),
  pluginTimeout: 30000,
  ajv: {
    customOptions: {
      coerceTypes: false,
      removeAdditional: "all",
    },
  },
}).withTypeProvider<TypeBoxTypeProvider>();

server.register(fp(buildServer));

await server.ready();

server.log.info(server.printPlugins());

await writeOpenApiDefinition(server);

server.listen({ host: "0.0.0.0", port: server.config.PORT }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});
