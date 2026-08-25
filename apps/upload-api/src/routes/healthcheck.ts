import { httpErrors } from "@fastify/sensible";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { getErrorMessage } from "@ogcio/shared-errors";
import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { getPackageInfo } from "../utils/get-package-info.js";
import { ensureS3Connectivity } from "./files/utils/manage-bucket.js";

const LivenessResponse = Type.Record(Type.String(), Type.String(), {
  description: "Indicates the liveness status of the service",
});

const ReadinessResponse = Type.Object(
  {
    db: Type.Boolean(),
  },
  {
    additionalProperties: false,
    description:
      "Indicates the readiness status of the service, pinging external dependencies",
  },
);

const StartupResponse = Type.Object(
  {
    system: Type.Boolean(),
    db: Type.Boolean(),
    s3: Type.Boolean(),
  },
  {
    additionalProperties: false,
    description:
      "Indicates the startup status of the service, pinging external dependencies",
  },
);

const StartupDependencyStatus = Type.Union([
  Type.Boolean(),
  Type.Object(
    {
      error: Type.String(),
    },
    { additionalProperties: false },
  ),
]);

const StartupFailureResponse = Type.Object(
  {
    system: StartupDependencyStatus,
    db: StartupDependencyStatus,
    s3: StartupDependencyStatus,
  },
  { additionalProperties: false },
);

type StartupDependencyName = "system" | "db" | "s3";

type StartupDependencyStatus = boolean | { error: string };

type StartupStatus = Record<StartupDependencyName, StartupDependencyStatus>;

const plugin: FastifyPluginAsyncTypebox = async function healthCheck(
  app: FastifyInstance,
) {
  app.get(
    "/health",
    {
      schema: {
        hide: true,
        response: {
          200: LivenessResponse,
        },
      },
    },
    async () => {
      const { name, version } = await getPackageInfo();
      return { [name]: version };
    },
  );

  app.get(
    "/health/ready",
    {
      schema: {
        hide: true,
        response: {
          200: ReadinessResponse,
        },
      },
    },
    async () => {
      await checkDb(app);
      return { db: true };
    },
  );

  app.get(
    "/health/startup",
    {
      schema: {
        hide: true,
        response: {
          200: StartupResponse,
          500: StartupFailureResponse,
        },
      },
    },
    async (_request, reply) => {
      const startupStatus: StartupStatus = {
        system: await checkStartupDependency(async () => {
          await getPackageInfo();
        }),
        db: await checkStartupDependency(async () => {
          await checkDb(app);
        }),
        s3: await checkStartupDependency(async () => {
          await ensureS3Connectivity(app.s3Client, app.log);
        }),
      };

      if (isStartupSuccessful(startupStatus)) {
        return startupStatus;
      }

      return reply.code(500).send(startupStatus);
    },
  );
};

export default plugin;

const checkStartupDependency = async (
  check: () => Promise<void>,
): Promise<StartupDependencyStatus> => {
  try {
    await check();
    return true;
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
};

const isStartupSuccessful = (startupStatus: StartupStatus): boolean => {
  return Object.values(startupStatus).every((status) => status === true);
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
