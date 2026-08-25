import { httpErrors } from "@fastify/sensible";
import type { BuildingBlocksSDK } from "@ogcio/building-blocks-sdk";
import type { FastifyBaseLogger } from "fastify";
import { getPersonalProfileSdk } from "./authentication-factory.js";

export type GetProfileResponse = Awaited<
  ReturnType<BuildingBlocksSDK["profile"]["getProfile"]>
>["data"];

export class PersonalProfileSdkWrapper {
  constructor(
    private readonly logger: FastifyBaseLogger,
    private readonly userData: { userId: string; accessToken: string },
  ) {}

  async getProfile(id: string): Promise<GetProfileResponse> {
    const sdk = await getPersonalProfileSdk(this.logger, this.userData);
    const userData = await sdk.getProfile(id);
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
}
