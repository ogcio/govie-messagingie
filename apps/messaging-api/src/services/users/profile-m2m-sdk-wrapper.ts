import type { FastifyBaseLogger } from "fastify";
import { getM2MProfileSdk } from "../../utils/authentication-factory.js";
import { ProfileSdkWrapper } from "./profile-sdk-wrapper.js";

export class ProfileM2MSdkWrapper extends ProfileSdkWrapper {
  constructor(
    private readonly logger: FastifyBaseLogger,
    private readonly organizationId?: string,
  ) {
    super(() => getM2MProfileSdk(this.logger, this.organizationId));
  }
}
