import type { FastifyBaseLogger } from "fastify";
import {
  buildLogtoClient,
  LogtoError,
  type SeededOrganizationCustomData,
} from "~/clients/logto.js";
import type { LogtoManagementConfig } from "~/plugins/external/env.js";

/**
 * Fetches organization metadata from Logto Management API;
 * @param organizationId - The organization ID to fetch metadata for;
 * @param config - Logto Management API configuration;
 * @param logger - Fastify logger instance;
 * @returns Organization metadata including customData;
 * @throws LogtoError if organization is not found (404) or if there's an upstream failure;
 */
export async function getOrganizationMetadata(
  organizationId: string,
  config: LogtoManagementConfig,
  logger: FastifyBaseLogger,
): Promise<SeededOrganizationCustomData> {
  try {
    const logtoClient = await buildLogtoClient(config);
    const organization = await logtoClient.getOrganization(organizationId);

    return {
      // Mapping manually the metadata field to the seeded custom data
      allowMyGovId: organization.customData.allowMyGovId,
    };
  } catch (error) {
    if (error instanceof LogtoError) {
      // Re-throw LogtoError to preserve status codes (404, 500, etc.)
      throw error;
    }

    // Log unexpected errors and wrap them;
    logger.error({
      message: "Error fetching organization metadata from Logto",
      error,
      organizationId,
    });

    throw new LogtoError(
      "Failed to fetch organization metadata",
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}
