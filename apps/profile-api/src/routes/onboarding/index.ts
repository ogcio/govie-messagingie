import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import type { LogtoClient } from "~/clients/logto.js";
import {
  MY_GOV_ID_IDENTITY,
  ONBOARDED_CITIZEN_ROLE_ID,
  ONBOARDING_CANDIDATE_ROLE_ID,
} from "~/const/logto.js";
import { Permissions } from "~/const/permissions.js";
import { ensureUserIdIsSet } from "~/utils/authentication-factory.js";

const REQUIRED_SAFE_LEVEL = 2;
const MYGOVID_CONNECTOR_ID = "mygovid";

const plugin: FastifyPluginAsyncTypebox = async (fastify: FastifyInstance) => {
  fastify.post(
    "/",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [
          Permissions.UserOnboarding.Read,
          Permissions.UserSelf.Write,
        ]),
      schema: {
        tags: ["Onboarding"],
        description:
          "Check SAFE level, assign the onboarded-citizen role, and revoke the onboarding-candidate bootstrap role when present",
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              safeLevel: { type: "number" },
            },
          },
          403: {
            type: "object",
            properties: {
              error: { type: "string" },
              safeLevel: { type: "number" },
              required: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = ensureUserIdIsSet(request);
      const logtoClient = await fastify.getLogtoClient();

      let safeLevel = await getSafeLevelFromLogs(logtoClient, userId);
      if (safeLevel === undefined) {
        safeLevel = await getSafeLevelFromUserIdentities(logtoClient, userId);
      }

      if (safeLevel === undefined) {
        // Return an explicit body — httpErrors.forbidden() is stripped to
        // `{ "error": "Forbidden" }` by the response schema serializer, which
        // profile-next cannot distinguish from a permissions failure.
        return reply.status(403).send({
          error: "Could not determine SAFE level for this user",
        });
      }

      if (safeLevel < REQUIRED_SAFE_LEVEL) {
        return reply.status(403).send({
          error: `SAFE level ${safeLevel} is below the required level ${REQUIRED_SAFE_LEVEL}`,
          safeLevel,
          required: REQUIRED_SAFE_LEVEL,
        });
      }

      await completeCitizenOnboarding(logtoClient, userId);

      return { success: true, safeLevel };
    },
  );
};

async function getSafeLevelFromLogs(
  logtoClient: Awaited<ReturnType<FastifyInstance["getLogtoClient"]>>,
  userId: string,
): Promise<number | undefined> {
  try {
    const logs = await logtoClient.getUserSignInLogs(userId);
    if (!Array.isArray(logs) || logs.length === 0) return undefined;

    const interaction = logs.at(0)?.payload.interaction;
    if (!interaction) return undefined;

    let level = interaction.verificationRecords?.find(
      (r) => r.connectorId?.toLowerCase() === MYGOVID_CONNECTOR_ID,
    )?.socialUserInfo?.rawData?.DSPOnlineLevel;

    if (level === undefined) {
      level = interaction.identifiers?.find(
        (i) => i.connectorId?.toLowerCase() === MYGOVID_CONNECTOR_ID,
      )?.userInfo?.rawData?.DSPOnlineLevel;
    }

    const parsed = Number(level);
    return Number.isNaN(parsed) ? undefined : parsed;
  } catch {
    return undefined;
  }
}

async function getSafeLevelFromUserIdentities(
  logtoClient: Awaited<ReturnType<FastifyInstance["getLogtoClient"]>>,
  userId: string,
): Promise<number | undefined> {
  try {
    const user = await logtoClient.getUser(userId);
    const level = Number(
      user?.identities?.[MY_GOV_ID_IDENTITY]?.details?.rawData?.DSPOnlineLevel,
    );
    return Number.isNaN(level) ? undefined : level;
  } catch {
    return undefined;
  }
}

/**
 * profile-next calls this endpoint through SAG. Legacy `apps/profile` assigns
 * `onboarded-citizen` via the Logto Management API instead; this handler stays
 * compatible with users who already hold that role (assign is idempotent) and
 * still revokes `onboarding-candidate` when present.
 */
async function completeCitizenOnboarding(
  logtoClient: LogtoClient,
  userId: string,
): Promise<void> {
  await logtoClient.assignUserRole(userId, ONBOARDED_CITIZEN_ROLE_ID);
  await logtoClient.removeUserRole(userId, ONBOARDING_CANDIDATE_ROLE_ID);
}

export default plugin;
export const autoPrefix = "/api/v1/onboarding";
