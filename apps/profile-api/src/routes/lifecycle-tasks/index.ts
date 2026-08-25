import { httpErrors } from "@fastify/sensible";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { getErrorMessage } from "@ogcio/shared-errors";
import type { FastifyInstance } from "fastify";

import type { Pool } from "pg";
import { Permissions } from "~/const/permissions.js";
import {
  type CreateLifecycleTaskBody,
  CreateLifecycleTaskSchema,
} from "~/schemas/data-lifecycle-tasks/create-user-export.js";
import {
  type GetLifecycleTask,
  type GetManyLifecycleTaskBody,
  GetManyLifecycleTaskSchema as getManySchema,
} from "~/schemas/data-lifecycle-tasks/get-many-user-export.js";
import {
  type LifecycleTaskActorType,
  LifecycleTaskActorTypes,
  LifecycleTaskStatuses,
  LifecycleTaskTypes,
  TaskTypesPerActor,
} from "~/schemas/data-lifecycle-tasks/index.js";
import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox,
} from "~/schemas/shared.js";
import { createDeleteProfileTask } from "~/services/data-lifecycle-tasks/create-delete-profile-task.js";
import { resetExportDataState } from "~/services/data-lifecycle-tasks/create-export-data.js";
import { getTasks } from "~/services/data-lifecycle-tasks/get-tasks.js";
import { AuditLogResourceTypes } from "~/types/audit-logger.js";
import { AuditLogger } from "~/utils/audit-logger.js";
import { getAuditCollectorSdk } from "~/utils/authentication-factory.js";
import { hasPermissions } from "~/utils/has-permissions.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify: FastifyInstance) => {
  fastify.post(
    "/search",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(
          req,
          res,
          [Permissions.UserSelf.Read, Permissions.Platform.Write],
          { method: "OR" },
        ),
      schema: getManySchema,
    },
    handleGetMany(fastify.pg.pool),
  );

  fastify.post(
    "/",
    {
      schema: CreateLifecycleTaskSchema,
      preValidation: (req, res) =>
        fastify.checkPermissions(
          req,
          res,
          [Permissions.UserSelf.Write, Permissions.Platform.Write],
          { method: "OR" },
        ),
    },
    async function handler(
      request: FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
      reply: FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
    ) {
      // using the fastify logger and not the request one
      // because the logger will be used to instantiate
      // the SDK
      const auditCollector = getAuditCollectorSdk(fastify.config, fastify.log);
      const userMetadata = request.userData?.isM2MApplication
        ? {
            requested_by_application_id: request.userData.userId,
            requested_by_user_id: request.body.requesterUserId ?? null,
          }
        : {
            requested_by_application_id: null,
            requested_by_user_id: request.userData?.userId ?? null,
          };
      const auditLogger = new AuditLogger(auditCollector, {
        metadata: {
          lifecyle_task_type: request.body.type,
          ...userMetadata,
          request_id: request.id,
        },
        client_timestamp: new Date().toISOString(),
        resource_type: AuditLogResourceTypes.LifecycleTask,
        action_type: "create",
      });

      const handled = await handleCreate(fastify.pg.pool, auditLogger)(
        request,
        reply,
      );

      reply.status(202).send(handled);
    },
  );
};

export function handleGetMany(pool: Pool) {
  return async (request: FastifyRequestTypebox<typeof getManySchema>) => {
    const { authenticatedId, isM2MApplication } = await validateRequestUser({
      app: request.server,
      request,
      reply: {} as FastifyReplyTypebox<typeof getManySchema>,
      neededCitizenPermission: Permissions.UserSelf.Read,
    });

    const userType = isM2MApplication
      ? LifecycleTaskActorTypes.M2M
      : LifecycleTaskActorTypes.Citizen;

    validateGetManyLifecycleTasksParams({
      body: request.body,
      userType,
      userId: authenticatedId,
    });

    const lifecycleTasks: GetLifecycleTask[] = [];

    try {
      const tasks = await getTasks({
        profileId: request.body.profileId ?? null,
        pgpool: pool,
        taskType: request.body.taskType ?? null,
      });
      for (const task of tasks) {
        lifecycleTasks.push({
          id: task.id,
          metadata: task.metadata,
          status: task.status,
          type: task.type,
        });
      }
    } catch (err) {
      throw httpErrors.internalServerError(getErrorMessage(err));
    }

    return {
      data: { tasks: lifecycleTasks },
    };
  };
}

export function handleCreate(
  pool: Pool,
  auditLogger: AuditLogger<
    | "user_id"
    | "metadata"
    | "client_timestamp"
    | "resource_type"
    | "action_type"
  >,
) {
  return async (
    req: FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
    reply: FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
  ): Promise<{ data: { id: string } }> => {
    const { requesterApplicationId, requesterUserId } =
      await validateCreateLifecycleTaskRequest({
        app: req.server,
        request: req,
        reply,
      });

    // This could potentially come from req.body
    const scheduledAt = new Date().toISOString();
    let id: string;
    const { type } = req.body;
    try {
      switch (type) {
        case LifecycleTaskTypes.ExportUserData:
          id = await resetExportDataState({
            profileId: req.body.profileId,
            requesterUserId,
            requesterApplicationId,
            scheduledAt,
            pool,
            allowOverride: requesterApplicationId !== null,
          });
          break;
        case LifecycleTaskTypes.DeleteProfile: {
          id = await createDeleteProfileTask({
            pool,
            toDeleteProfileId: req.body.profileId,
            requesterApplicationId,
            requesterUserId,
          });
          break;
        }
        default:
          auditLogger.safeSendLogs([
            {
              successful: false,
              failure_reason: "Unsupported lifecycle task type",
            },
          ]);
          throw httpErrors.badRequest(`unsupported type '${type}'`);
      }

      auditLogger.safeSendLogs([
        {
          successful: true,
          resource_id: id,
          metadata: {
            ...auditLogger.defaultValues.metadata,
            lifecycle_task_status: LifecycleTaskStatuses.Pending,
          },
        },
      ]);

      return { data: { id } };
    } catch (err) {
      auditLogger.safeSendLogs([
        {
          successful: false,
          failure_reason: getErrorMessage(err),
        },
      ]);
      throw err;
    }
  };
}

async function validateCreateLifecycleTaskRequest(params: {
  app: FastifyInstance;
  reply: FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>;
  request: FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>;
}): Promise<{
  requesterUserId: string | null;
  requesterApplicationId: string | null;
}> {
  const { authenticatedId, isM2MApplication } = await validateRequestUser({
    ...params,
    neededCitizenPermission: Permissions.UserSelf.Write,
  });

  const userType = isM2MApplication
    ? LifecycleTaskActorTypes.M2M
    : LifecycleTaskActorTypes.Citizen;

  const { requesterUserId, requesterApplicationId } =
    validateCreateLifecycleTaskBody({
      body: params.request.body,
      userType: userType,
      userId: authenticatedId,
      isM2MApplicationRequester: isM2MApplication,
    });

  return { requesterUserId, requesterApplicationId };
}

async function validateRequestUser<T extends object>(params: {
  app: FastifyInstance;
  reply: FastifyReplyTypebox<T>;
  request: FastifyRequestTypebox<T>;
  neededCitizenPermission: string;
}): Promise<{ authenticatedId: string; isM2MApplication: boolean }> {
  const { app, request, reply } = params;

  if (!request.userData) {
    throw httpErrors.forbidden(
      "You must be authenticated to work on a lifecycle task",
    );
  }

  const { isM2MApplication, organizationId } = request.userData;

  if (organizationId) {
    throw httpErrors.forbidden("Citizen users only can access lifecycle tasks");
  }

  if (isM2MApplication) {
    const isSuperAdmin = await hasPermissions({
      app,
      request,
      reply,
      permissions: [Permissions.Platform.Write],
    });
    if (!isSuperAdmin) {
      throw httpErrors.unauthorized("Cannot access this endpoint");
    }

    return { authenticatedId: request.userData.userId, isM2MApplication };
  }

  const isAllowedCitizen = await hasPermissions({
    app,
    request,
    reply,
    permissions: [params.neededCitizenPermission],
  });

  if (!isAllowedCitizen) {
    throw httpErrors.unauthorized("Cannot access this endpoint");
  }

  return { authenticatedId: request.userData.userId, isM2MApplication };
}

function validateCreateLifecycleTaskBody(params: {
  body: CreateLifecycleTaskBody;
  userType: LifecycleTaskActorType;
  userId: string;
  isM2MApplicationRequester: boolean;
}): { requesterUserId: string | null; requesterApplicationId: string | null } {
  const { body, userType, userId, isM2MApplicationRequester } = params;

  if (
    userType === LifecycleTaskActorTypes.Citizen &&
    body.profileId !== userId
  ) {
    throw httpErrors.forbidden(
      "You can only create lifecycle tasks for your own profile",
    );
  }

  const validTypesForUser = TaskTypesPerActor[userType];
  if (!validTypesForUser) {
    throw httpErrors.internalServerError(
      "Invalid user type for lifecycle task creation",
    );
  }

  if (!validTypesForUser.includes(body.type)) {
    throw httpErrors.unauthorized(
      `Users of type '${userType}' cannot create lifecycle tasks of type '${body.type}'`,
    );
  }

  if (isM2MApplicationRequester) {
    return {
      requesterUserId: body.requesterUserId ?? null,
      requesterApplicationId: userId,
    };
  }

  return {
    requesterUserId: userId,
    requesterApplicationId: null,
  };
}

function validateGetManyLifecycleTasksParams(params: {
  body: GetManyLifecycleTaskBody;
  userType: LifecycleTaskActorType;
  userId: string;
}) {
  const { body, userType, userId } = params;

  if (
    userType === LifecycleTaskActorTypes.Citizen &&
    body.profileId !== userId
  ) {
    throw httpErrors.forbidden(
      "You can only manage lifecycle tasks for your own profile",
    );
  }
}

export default plugin;
export const autoPrefix = "/api/v1/lifecycle-tasks";
