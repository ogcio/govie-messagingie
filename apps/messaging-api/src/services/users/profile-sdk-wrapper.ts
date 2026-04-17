import type { NodeCache } from "@cacheable/node-cache";
import { httpErrors } from "@fastify/sensible";
import type { BuildingBlocksSDK } from "@ogcio/building-blocks-sdk";
import type { FastifyBaseLogger } from "fastify";

export type GetProfileResponse = Awaited<
  ReturnType<BuildingBlocksSDK["profile"]["getProfile"]>
>["data"];

export type ProfileConsentStatuses = GetProfileResponse["consentStatuses"];

export type GetOrganisationResponse = Awaited<
  ReturnType<BuildingBlocksSDK["profile"]["getOrganisation"]>
>["data"];

export abstract class ProfileSdkWrapper {
  private ORG_TRANSLATION_CACHE_KEY_PREFIX = "org_translations";

  constructor(
    private readonly getSdkFn: () => Promise<BuildingBlocksSDK["profile"]>,
  ) {}

  async getProfile(
    id: string,
    consentSubjects?: string[],
  ): Promise<GetProfileResponse> {
    const sdk = await this.getSdkFn();

    const userData = await sdk.getProfile(
      id,
      undefined,
      undefined,
      consentSubjects,
    );

    if (userData.error) {
      throw httpErrors.createError(
        503,
        `Failed fetching user from profile sdk: ${userData.error.detail}`,
        {
          parent: userData.error,
        },
      );
    }

    if (!userData.data) {
      throw httpErrors.notFound(`User with ${id} id not found`);
    }

    return userData.data;
  }

  async getLinkedProfileIds(mainId: string): Promise<string[]> {
    const profile = await this.getProfile(mainId);
    const linkedProfiles = profile.linkedProfiles ?? [];
    const linkedProfilesIds = linkedProfiles.map((profile) => profile.id);
    return linkedProfilesIds;
  }

  async getOrganisation(
    id: string,
  ): Promise<NonNullable<GetOrganisationResponse>["data"]> {
    const sdk = await this.getSdkFn();
    const response = await sdk.getOrganisation(id);
    if (response.response.status === 404) {
      throw httpErrors.notFound(`Organisation with ${id} id not found`);
    }
    if (response.response.status === 500) {
      throw httpErrors.internalServerError(
        `Failed fetching organisation from profile sdk: ${response.error?.detail}`,
      );
    }
    if (!response.data) {
      throw httpErrors.notFound(
        `No data returned from profile SDK for organisation ${id}`,
      );
    }
    return response.data.data;
  }

  async getOrganisationWithCache(
    id: string,
    // biome-ignore lint/suspicious/noExplicitAny: insert any type
    cache: NodeCache<any>,
    _logger: FastifyBaseLogger,
  ): Promise<NonNullable<GetOrganisationResponse>["data"]> {
    const cached = cache.get(
      `${this.ORG_TRANSLATION_CACHE_KEY_PREFIX}_${id}`,
    ) as NonNullable<GetOrganisationResponse>["data"] | undefined;
    if (cached) {
      return cached;
    }

    const organisation = await this.getOrganisation(id);
    cache.set(`${this.ORG_TRANSLATION_CACHE_KEY_PREFIX}_${id}`, organisation);

    return organisation;
  }

  ensureUserConsented(
    consentStatuses: ProfileConsentStatuses,
    profileStatus: string | undefined,
  ): void {
    if (
      consentStatuses === null ||
      consentStatuses === undefined ||
      !consentStatuses.messaging ||
      !consentStatuses.messaging.status
    ) {
      return;
    }

    const validUserStatus = "active";

    if (
      profileStatus !== undefined &&
      profileStatus.toLowerCase() !== validUserStatus
    ) {
      throw httpErrors.badRequest(
        "User profile is not active. Messages cannot be sent to deleted or disabled profiles.",
      );
    }
    const optedOutStatuses = ["opted-out", "pending", "undefined"];

    if (optedOutStatuses.includes(consentStatuses.messaging.status)) {
      throw httpErrors.badRequest(
        "User has not consented to receive messages. Please check the user's consent status.",
      );
    }
  }
}
