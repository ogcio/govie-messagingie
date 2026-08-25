import type { FastifyInstance } from "fastify";
import { getSchedulerSdk } from "./authentication-factory.js";
import { getConfigValue, SCHEDULER_TOKEN } from "./storeConfig.js";

const scheduleCleanupTask = async (app: FastifyInstance) => {
  /**
   * The org id is hardcoded for now,
   * we will change this in the future once we have a better m2m management
   */
  const schedulerSdk = await getSchedulerSdk(
    app.config.ORGANIZATION_ID as string,
    app.log,
  );

  const schedulerToken = (await getConfigValue(
    app.pg.pool,
    SCHEDULER_TOKEN,
  )) as string;

  const hoursInterval = app.config.SCHEDULED_JOBS_HOURS_INTERVAL as number;
  const scheduleDate = new Date();
  scheduleDate.setHours(scheduleDate.getHours() + hoursInterval);

  try {
    await schedulerSdk.scheduleTasks([
      {
        executeAt: scheduleDate.toISOString(),
        webhookUrl: new URL(
          "/api/v1/jobs",
          app.config.HOST as string,
        ).toString(),
        webhookAuth: schedulerToken,
      },
    ]);

    app.log.info(`Scheduled next job at: ${scheduleDate.toISOString()}`);
  } catch (err) {
    app.log.error(err);
  }
};

export default scheduleCleanupTask;
