import { httpErrors } from "@fastify/sensible";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { getErrorMessage } from "@ogcio/shared-errors";
import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { getPackageInfo } from "../utils/get-package-info.js";

export const HealthCheckSchema = {
  tags: ["Health"],
  hide: true,
  description: "It checks the current liveness status of the API",
  response: {
    200: Type.Record(Type.String(), Type.String(), {
      description: "Indicates the liveness status of the service",
    }),
  },
};

export const HealthCheckReadySchema = {
  tags: ["Health"],
  hide: true,
  description:
    "It checks the readiness status of the API, pinging external dependencies",
  response: {
    200: Type.Object(
      {
        db: Type.Boolean(),
      },
      {
        additionalProperties: false,
        description:
          "Indicates the readiness status of the service, pinging external dependencies",
      },
    ),
  },
};

const plugin: FastifyPluginAsyncTypebox = async function healthCheck(
  app: FastifyInstance,
) {
  app.get(
    "/health",
    {
      schema: HealthCheckSchema,
    },
    async () => {
      const { name, version } = await getPackageInfo();
      return { [name]: version };
    },
  );

  app.get(
    "/health/ready",
    {
      schema: HealthCheckReadySchema,
    },
    async () => {
      await checkDb(app);
      return { db: true };
    },
  );
};

const checkDb = async (app: FastifyInstance): Promise<void> => {
  const pool = await app.pg.connect();
  try {
    const res = await app.pg.query('SELECT 1 as "column"');
    if (res.rowCount !== 1) {
      throw httpErrors.internalServerError(
        `Expected 1 record, got ${res.rowCount}`,
      );
    }
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "status" in e &&
      typeof e.status === "number" &&
      "statusCode" in e &&
      typeof e.statusCode === "number"
    ) {
      throw e;
    }

    throw httpErrors.internalServerError(getErrorMessage(e));
  } finally {
    pool.release();
  }
};

export default plugin;
export const autoPrefix = "";
