import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { getLoggingConfiguration } from "@ogcio/fastify-logging-wrapper";
import type { FastifyInstance } from "fastify";
import type { PinoLoggerOptions } from "fastify/types/logger.js";
import { build } from "./app.js";
import { worker } from "./worker.js";

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

const scheduler = await worker(app, randomUUID().toString());

app.listen({ host: "0.0.0.0", port: 8005 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`app listening at ${address}`);
});

scheduler.start();

await app.ready();
await writeOpenApiDefinition(app);
