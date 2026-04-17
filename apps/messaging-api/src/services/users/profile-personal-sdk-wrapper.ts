import type { FastifyBaseLogger } from "fastify";
import { getPersonalProfileSdk } from "../../utils/authentication-factory.js";
import { ProfileSdkWrapper } from "./profile-sdk-wrapper.js";

export class ProfilePersonalSdkWrapper extends ProfileSdkWrapper {
  constructor(
    private readonly logger: FastifyBaseLogger,
    private readonly userData: { userId: string; accessToken: string },
  ) {
    super(() => getPersonalProfileSdk(this.logger, this.userData));
  }
}
