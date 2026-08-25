import { isNativeError } from "node:util/types";
import type NodeCache from "@cacheable/node-cache";
import { httpErrors } from "@fastify/sensible";
import {
  type LoggingError,
  toLoggingError,
} from "@ogcio/fastify-logging-wrapper";
import { getErrorMessage } from "@ogcio/shared-errors";
import type { FastifyBaseLogger } from "fastify";
import { isHttpError } from "http-errors";
import type { Pool, PoolClient } from "pg";
import type { EnvConfig } from "../../plugins/external/env.js";
import { JobTypes } from "../../types/jobs.js";
import type {
  MessageToDeliver,
  MessageToDeliverWoAttachments,
} from "../../types/messages.js";
import type { EmailProvider } from "../../types/providers.js";
import CryptographyService from "../../utils/cryptography-service.js";
import type { I18n } from "../../utils/i18n.js";
import {
  messageDeliveryDurationHistogram,
  messagesFailedCounter,
  messagesSentCounter,
} from "../../utils/metrics.js";
import type { ServiceError } from "../../utils/utils.js";
import {
  type EventType,
  type MessageEventData,
  type MessagingEventLogger,
  MessagingEventType,
} from "../messages/event-logger.js";
import { EmailSpecificProvider } from "../providers/email/email-specific-provider.js";
import { EmailSpecificTransport } from "../providers/email/email-specific-transport.js";
import { ProfileM2MSdkWrapper } from "../users/profile-m2m-sdk-wrapper.js";
import type {
  GetOrganisationResponse,
  GetProfileResponse,
  ProfileSdkWrapper,
} from "../users/profile-sdk-wrapper.js";
import { AvailableTransports } from "../users/shared-users.js";
import { prepareForSecureDelivery } from "./secure-message-processor.js";

export type ScheduledMessageStatus =
  | "pending"
  | "working"
  | "failed"
  | "delivered";
export const JobStatus = {
  Working: "working",
  Pending: "pending",
  Failed: "failed",
  Delivered: "delivered",
};

export type RunningJob = {
  jobId: string;
  userId: string;
  type: string;
  status: ScheduledMessageStatus;
  organizationId: string;
};

export type PendingJobCounter = {
  organizationId: string;
  counter: number;
};

export const executeJob = async (params: {
  config: EnvConfig;
  pool: Pool;
  logger: FastifyBaseLogger;
  jobId: string;
  token: string;
  eventLogger: MessagingEventLogger;
  i18n: I18n;
  // biome-ignore lint/suspicious/noExplicitAny: insert any type
  cache: NodeCache<any>;
}): Promise<void> => {
  const job = await setJobAsRunning({
    eventLogger: params.eventLogger,
    pool: params.pool,
    job: { id: params.jobId, token: params.token },
  });
  switch (job.type) {
    case JobTypes.Message:
      await processMessageJob({
        config: params.config,
        job,
        eventLogger: params.eventLogger,
        pool: params.pool,
        logger: params.logger,
        i18n: params.i18n,
        cache: params.cache,
      });
      break;
    default:
      params.logger.warn(job, "Job has unrecognized type");
  }
};

async function setJobAsRunning(params: {
  eventLogger: MessagingEventLogger;
  pool: Pool;
  job: { id: string; token: string };
}): Promise<RunningJob> {
  const { pool, job, eventLogger } = params;
  let runningJob: RunningJob | undefined;
  let jobResult:
    | {
        status: ScheduledMessageStatus;
        entityId: string;
        organizationId: string;
      }
    | undefined;
  try {
    const jobStatusResult = await pool.query<{
      status: ScheduledMessageStatus;
      entityId: string;
      organizationId: string;
    }>(
      `
        SELECT
          coalesce(delivery_status, 'pending') as "status",
          job_id as "entityId",
          organisation_id as "organizationId"
        FROM jobs WHERE id = $1
        AND case when delivery_status is not null then delivery_status != $2 else true end
        AND job_token = $3
    `,
      [job.id, JobStatus.Delivered, job.token],
    );

    jobResult = jobStatusResult.rows.at(0);

    if (!jobResult) {
      throw httpErrors.notFound("job doesn't exist");
    }

    if (jobResult.status === JobStatus.Working) {
      throw httpErrors.badRequest("job is already in progress");
    }

    eventLogger.log(
      MessagingEventType.deliverMessagePending,
      { messageId: jobResult.entityId }, // job id error field?
    );

    const updateResult = await pool.query<RunningJob>(
      `
        UPDATE jobs SET delivery_status = $1
        WHERE id = $2
        returning 
        user_id as "userId",
        job_type as "type",
        job_id as "jobId",
        organisation_id as "organizationId",
        delivery_status as "status"
    `,
      [JobStatus.Working, job.id],
    );

    runningJob = updateResult.rows.at(0);
    if (!runningJob) {
      throw httpErrors.notFound("Not able to find job to update");
    }
  } catch (err) {
    eventLogger.log(MessagingEventType.deliverMessageError, {
      messageId: job.id,
    });
    messagesFailedCounter.add(1, {
      organizationId: jobResult?.organizationId ?? "unknown",
      stage: "deliver",
    });
    if (isHttpError(err)) {
      throw err;
    }

    throw httpErrors.createError(500, "Failed fetching/updating job", {
      parent: err,
    });
  }

  if (!runningJob.userId || !runningJob.type) {
    eventLogger.log(MessagingEventType.deliverMessageError, {
      messageId: runningJob?.jobId || job.id,
    });
    messagesFailedCounter.add(1, {
      organizationId: runningJob.organizationId ?? "unknown",
      stage: "deliver",
    });
    throw httpErrors.internalServerError(
      `job row with id ${runningJob.jobId} missing critical fields`,
    );
  }

  return runningJob;
}

async function processMessageJob(params: {
  config: EnvConfig;
  job: RunningJob;
  eventLogger: MessagingEventLogger;
  pool: Pool;
  logger: FastifyBaseLogger;
  i18n: I18n;
  // biome-ignore lint/suspicious/noExplicitAny: insert any type
  cache: NodeCache<any>;
}) {
  const { job, eventLogger, pool, logger, i18n, config, cache } = params;
  let profileWrapper: ProfileSdkWrapper | null = null;
  let profile: GetProfileResponse | null = null;
  let deliveryError: LoggingError | undefined;
  let organisation: NonNullable<GetOrganisationResponse>["data"] | undefined;
  let eventToLogData: MessageEventData | undefined;
  try {
    profileWrapper = new ProfileM2MSdkWrapper(logger, job.organizationId);
  } catch (e) {
    const msg = isNativeError(e)
      ? e.message
      : "failed to initialize profile SDK";
    deliveryError = toLoggingError(httpErrors.internalServerError(msg));
    logger.error({ error: deliveryError.parent }, deliveryError.message);
    eventToLogData = {
      messageId: job.jobId,
      details: msg,
      messageKey: "sdkInitError",
    };
  }

  if (!profileWrapper) {
    const eventToLog = eventToLogData
      ? {
          type: MessagingEventType.deliverMessageError,
          eventData: eventToLogData,
        }
      : undefined;
    return updateJobStatus({ ...params, deliveryError, eventToLog });
  }

  try {
    profile = await profileWrapper.getProfile(job.userId);
  } catch (e) {
    const msg = isNativeError(e) ? e.message : "failed to retrieve profile";
    deliveryError = toLoggingError(httpErrors.internalServerError(msg));
    logger.error({ error: deliveryError.parent }, deliveryError.message);
    eventToLogData = {
      messageId: job.jobId,
      details: msg,
      messageKey: "profileFetchError",
    };
  }

  if (!profile) {
    const eventToLog = eventToLogData
      ? {
          type: MessagingEventType.deliverMessageError,
          eventData: eventToLogData,
        }
      : undefined;
    return updateJobStatus({ ...params, deliveryError, eventToLog });
  }

  try {
    organisation = await profileWrapper.getOrganisationWithCache(
      job.organizationId,
      cache,
      logger,
    );
  } catch (e) {
    const msg = isNativeError(e)
      ? e.message
      : "failed to retrieve organisation";
    deliveryError = toLoggingError(httpErrors.internalServerError(msg));
    logger.error({ error: deliveryError.parent }, deliveryError.message);
    eventToLogData = {
      messageId: job.jobId,
      details: msg,
      messageKey: "organisationFetchError",
    };
  }

  if (!organisation) {
    const eventToLog = eventToLogData
      ? {
          type: MessagingEventType.deliverMessageError,
          eventData: eventToLogData,
        }
      : undefined;
    return updateJobStatus({ ...params, deliveryError, eventToLog });
  }

  const deliveryResult = await deliverMessage({
    pool,
    jobId: job.jobId,
    eventLogger,
    organizationId: job.organizationId,
    messageId: job.jobId,
    logger,
    i18n,
    config,
    profile,
    organisation,
  });

  // Commented out SMS delivery for now
  // new SmsSender({
  //   profile,
  //   organizationId: job.organizationId,
  //   logger,
  //   config,
  //   getTransport: () => new SnsSmsTransport({ config, logger }),
  //   i18n,
  //   organisation,
  // }).send();
  return updateJobStatus({
    ...params,
    deliveryError: deliveryResult.error,
    eventToLog: deliveryResult.eventToLog,
  });
}

async function deliverMessage(params: {
  pool: Pool;
  messageId: string;
  eventLogger: MessagingEventLogger;
  organizationId: string;
  logger: FastifyBaseLogger;
  jobId: string;
  i18n: I18n;
  config: EnvConfig;
  profile: GetProfileResponse;
  organisation: NonNullable<GetOrganisationResponse>["data"];
}): Promise<{
  error?: LoggingError;
  eventToLog?: { type: EventType; eventData: MessageEventData };
}> {
  let _err: unknown;
  const { messageId, pool, logger, jobId, profile } = params;
  let messageData: MessageToDeliver | undefined;
  try {
    messageData = await getMessageToDeliver({
      messageId,
      recipientUserId: profile.id,
      client: pool,
    });
  } catch (messageErr) {
    logger.error({ error: messageErr }, "Get message to deliver error");
    _err = messageErr;
  }

  if (!messageData) {
    return {
      error: toLoggingError(
        httpErrors.createError(500, "Error retrieving message", {
          parent: _err,
        }),
      ),
      eventToLog: {
        type: MessagingEventType.deliverMessageError,
        eventData: {
          messageId,
          details: isNativeError(_err) ? _err.message : "unknown error",
          messageKey: "messageFetchError",
        },
      },
    };
  }

  try {
    const transportResult = await sendMessageToTransports({
      ...params,
      messageData,
    });

    for (const err of transportResult.errors) {
      logger.error({ error: err.error }, err.msg);
    }

    const firstError = transportResult.errors
      .filter((err) => err.critical)
      .at(0);
    let loggingError: LoggingError | undefined;
    if (firstError) {
      loggingError = toLoggingError(
        httpErrors.internalServerError(firstError.msg),
      );
    }
    if (!loggingError) {
      return {
        eventToLog: {
          type: MessagingEventType.deliverMessage,
          eventData: { messageId: jobId },
        },
      };
    }

    return {
      error: loggingError,
      eventToLog: transportResult.eventToLog,
    };
  } catch (err) {
    logger.error({ error: err }, "Deliver message error");
    _err = err;
  }

  if (_err)
    return {
      error: toLoggingError(
        httpErrors.createError(500, "Error sending message", { parent: _err }),
      ),
      eventToLog: {
        type: MessagingEventType.deliverMessageError,
        eventData: {
          messageId,
          details: isNativeError(_err) ? _err.message : "unknown error",
          messageKey: "deliverMessageError",
        },
      },
    };

  return {};
}

async function getMessageToDeliver(params: {
  messageId: string;
  recipientUserId: string;
  client: PoolClient | Pool;
}): Promise<MessageToDeliver> {
  const { messageId, client } = params;
  const messageUpdateQueryResult = await client.query<
    MessageToDeliverWoAttachments & {
      attachmentId?: string;
    }
  >(
    `
    SELECT 
    m.id,
    m.preferred_transports AS "transports",
    m.excerpt,
    m.subject,
    m.security_level as "securityLevel",
    m.plain_text as "body",
    m.rich_text as "richText",
    aid.attachment_id AS "attachmentId",
    m.external_id as "externalId",
    m.created_at as "createdAt"
    FROM messages m
    LEFT JOIN (
        SELECT attachment_id, message_id 
        FROM attachments_messages
    ) aid
    ON m.id = aid.message_id
    WHERE m.id = $1;
  `,
    [messageId],
  );
  let messageData: MessageToDeliver | undefined;
  const attachmentIds = [];
  for (const row of messageUpdateQueryResult.rows) {
    if (row.attachmentId) {
      attachmentIds.push(row.attachmentId);
    }
    if (!messageData) {
      messageData = {
        body: row.body,
        excerpt: row.excerpt || undefined,
        subject: row.subject,
        transports: row.transports ? row.transports : undefined,
        attachmentIds: undefined,
        securityLevel: row.securityLevel,
        id: row.id,
        richText: row.richText || undefined,
        externalId: row.externalId || undefined,
        createdAt: row.createdAt || undefined,
      };
    }
  }

  if (!messageData) {
    throw httpErrors.notFound(`failed to find message for id ${messageId}`);
  }
  messageData.attachmentIds =
    attachmentIds.length > 0 ? attachmentIds : undefined;

  return messageData;
}

async function updateJobStatus(params: {
  deliveryError: LoggingError | undefined;
  pool: Pool;
  job: { jobId: string; userId: string; organizationId?: string };
  eventLogger: MessagingEventLogger;
  eventToLog?: { type: EventType; eventData: MessageEventData };
}): Promise<void> {
  const { pool, deliveryError, job } = params;

  if (deliveryError) {
    await pool.query(
      `
          UPDATE jobs SET delivery_status = $1
          WHERE job_id = $2 AND user_id = $3
        `,
      [JobStatus.Failed, job.jobId, job.userId],
    );
  } else {
    await setMessageAsDelivered({
      messageId: job.jobId,
      recipientUserId: job.userId,
      pool,
    });
  }
  if (params.eventToLog) {
    params.eventLogger.log(params.eventToLog.type, params.eventToLog.eventData);
    if (
      params.eventToLog.type === MessagingEventType.deliverMessageError ||
      params.eventToLog.type === MessagingEventType.emailError
    ) {
      messagesFailedCounter.add(1, {
        organizationId: params.job.organizationId ?? "unknown",
        stage:
          params.eventToLog.type === MessagingEventType.emailError
            ? "email"
            : "deliver",
      });
    }
  }
}

async function setMessageAsDelivered(params: {
  messageId: string;
  recipientUserId: string;
  pool: Pool;
}): Promise<void> {
  const { messageId, pool } = params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const messageUpdateQueryResult = await client.query<{ id: string }>(
      `
    UPDATE messages m set 
      is_delivered = true,
      updated_at = now()
    WHERE m.id = $1
    RETURNING m.id
  `,
      [messageId],
    );

    if (messageUpdateQueryResult.rowCount === 0) {
      throw httpErrors.notFound(`failed to find message for id ${messageId}`);
    }

    await client.query(
      `
      UPDATE jobs SET delivery_status = $1
      WHERE job_id = $2 AND user_id = $3
    `,
      [JobStatus.Delivered, messageId, params.recipientUserId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function sendMessageToTransports(params: {
  pool: Pool;
  organizationId: string;
  messageId: string;
  messageData: MessageToDeliver;
  eventLogger: MessagingEventLogger;
  logger: FastifyBaseLogger;
  i18n: I18n;
  config: EnvConfig;
  profile: GetProfileResponse;
  organisation: NonNullable<GetOrganisationResponse>["data"];
}): Promise<{
  errors: ServiceError[];
  eventToLog?: { type: EventType; eventData: MessageEventData };
}> {
  // if the only selected transport is life event or no transports are set, we are okay
  const onlyEditableTransports =
    params.messageData.transports?.filter(
      (t) => t !== AvailableTransports.LIFE_EVENT,
    ) ?? [];

  if (!onlyEditableTransports.length) {
    return { errors: [] };
  }

  // At the moment we only manage email as transport
  if (!onlyEditableTransports.includes(AvailableTransports.EMAIL)) {
    return { errors: [] };
  }

  const criticalError = {
    critical: true,
    msg: "Not been able to send to any transport",
    error: httpErrors.badGateway("Message has not been sent anywhere"),
  };

  const secureMessage = getSecureMessage(params);
  if (secureMessage.error) {
    return {
      errors: [secureMessage.error, criticalError],
      eventToLog: {
        type: MessagingEventType.deliverMessage,
        eventData: {
          messageId: params.messageId,
          messageKey: "secureMessagePreparationError",
          details: secureMessage.error.msg,
        },
      },
    };
  }

  const provider = await getProvider(params);
  if (!provider) {
    return {
      errors: [criticalError],
      eventToLog: {
        type: MessagingEventType.deliverMessage,
        eventData: {
          messageId: params.messageId,
          messageKey: "noProvider",
          details: "No provider found for organisation",
        },
      },
    };
  }

  const sentResult = await sendEmail({
    ...params,
    provider,
    secureMessage: secureMessage.secureMessage,
  });
  if (!sentResult.sent) {
    if (sentResult.error) {
      return {
        errors: [sentResult.error, criticalError],
        eventToLog: {
          type: MessagingEventType.emailError,
          eventData: {
            messageId: params.messageId,
            messageKey: "failedToSend",
            details: sentResult.error.details,
          },
        },
      };
    }
    return { errors: [criticalError], eventToLog: sentResult.eventToLog };
  }

  messagesSentCounter.add(1, {
    organizationId: params.organizationId,
  });
  if (params.messageData.createdAt) {
    const seconds =
      (Date.now() - new Date(params.messageData.createdAt).getTime()) / 1000;
    // guard: never record garbage from an unparsable timestamp
    if (Number.isFinite(seconds) && seconds >= 0) {
      messageDeliveryDurationHistogram.record(seconds, {
        organizationId: params.organizationId,
      });
    }
  }

  return { errors: [] };
}

function getSecureMessage(params: {
  profile: GetProfileResponse;
  i18n: I18n;
  organisation: NonNullable<GetOrganisationResponse>["data"];
  messageData: MessageToDeliver;
  logger: FastifyBaseLogger;
}):
  | {
      secureMessage: MessageToDeliver & { transports: string[] };
      error?: undefined;
    }
  | { secureMessage?: undefined; error: ServiceError } {
  try {
    return {
      secureMessage: prepareForSecureDelivery({
        ...params,
        messageToDeliver: params.messageData,
      }),
    };
  } catch (error) {
    params.logger.error({ error }, "Failed to prepare secure message");
    return {
      error: {
        critical: false,
        error: { error },
        msg: isNativeError(error)
          ? error.message
          : "failed to externally transport message",
      },
    };
  }
}

async function getProvider({
  organizationId,
  pool,
  logger,
  config,
}: {
  organizationId: string;
  pool: Pool;
  logger: FastifyBaseLogger;
  config: EnvConfig;
}): Promise<EmailProvider | null> {
  try {
    const providerClient = new EmailSpecificProvider(
      pool,
      organizationId,
      new CryptographyService(config),
      config,
      logger,
    );
    const provider = await providerClient.getPrimaryOrDefault();

    if (!provider) {
      logger.warn(
        { transport: "email" },
        `No primary provider found for organisation ${organizationId}, using default provider`,
      );

      return null;
    }

    return provider;
  } catch (_e) {
    logger.warn(
      { transport: "email" },
      `No primary provider found for organisation ${organizationId}`,
    );

    return null;
  }
}

async function sendEmail({
  provider,
  secureMessage,
  profile,
  messageId,
  logger,
}: {
  provider: EmailProvider;
  secureMessage: MessageToDeliver;
  profile: GetProfileResponse;
  messageId: string;
  logger: FastifyBaseLogger;
}): Promise<{
  sent: boolean;
  error: ServiceError | null;
  eventToLog?: { type: EventType; eventData: MessageEventData };
}> {
  try {
    const specificTransport = new EmailSpecificTransport(provider);
    const canBeSentResult = await specificTransport.checkIfMessageCanBeSent({
      message: secureMessage,
      userAddress: profile.email,
    });
    if (!canBeSentResult.canBeSent) {
      return {
        sent: false,
        error: null,
        eventToLog: canBeSentResult.eventToLog,
      };
    }

    await specificTransport.sendMessage({
      message: secureMessage,
      recipientAddress: profile.email,
    });

    return { sent: true, error: null };
  } catch (err) {
    logger.error({ error: err }, "Failed to send message");

    return {
      sent: false,
      error: {
        critical: false,
        error: {
          userId: profile.id,
          providerId: provider.id,
          messageId,
        },
        details: JSON.stringify(err),
        msg: "failed to send email",
      },
    };
  }
}

export async function getPendingJobPerOrganization(params: {
  pool: Pool;
  logger: FastifyBaseLogger;
}): Promise<PendingJobCounter[]> {
  const { pool, logger } = params;
  try {
    const pendingJobResult = await pool.query<{
      counter: number;
      organizationId: string;
    }>(
      `
        SELECT
          count(*) as counter,
          organisation_id as "organizationId"
        FROM jobs
        WHERE delivery_status = $1
        GROUP BY organisation_id
    `,
      [JobStatus.Pending],
    );

    // SQL returns count as string, we need to convert it to number
    return pendingJobResult.rows.map((row) => ({
      counter: Number(row.counter),
      organizationId: row.organizationId,
    }));
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    if (isHttpError(err)) {
      logger.error(
        { error: errorMessage, statusCode: err.statusCode },
        "HTTP error fetching pending jobs",
      );
    }
    logger.error({ error: errorMessage }, "Error fetching pending jobs");
  }

  return [];
}
