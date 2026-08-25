import { writeFile } from "node:fs/promises";
import { getLoggingConfiguration } from "@ogcio/fastify-logging-wrapper";
import type { FastifyInstance } from "fastify";
import type { PinoLoggerOptions } from "fastify/types/logger.js";
import { build } from "./app.js";

const writeOpenApiDefinition = async (app: FastifyInstance) => {
  try {
    await writeFile("./openapi-definition.yml", app.swagger({ yaml: true }));
  } catch (e) {
    app.log.warn(e, "Error writing open api definition file");
  }
};

const app = await build(
  getLoggingConfiguration({
    additionalLoggerConfigs: {
      level: (process.env.LOG_LEVEL ?? "debug") as PinoLoggerOptions["level"],
    },
  }),
);

app.listen({ host: "0.0.0.0", port: 8008 }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});

await app.ready();
await writeOpenApiDefinition(app);
