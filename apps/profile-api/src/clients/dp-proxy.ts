import type pino from "pino";

export interface DPProxyClientConfig {
  baseUrl: string;
  getToken: () => string | Promise<string>;
}

export interface AnonymizeUserRequest {
  event: "anonymize_user";
  profileIds: string[];
}

export class DPProxyClient {
  private baseUrl: string;
  private getToken: () => string | Promise<string>;

  constructor(config: DPProxyClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.getToken = config.getToken;
  }

  async anonymizeUser(
    request: AnonymizeUserRequest,
    logger: pino.Logger,
  ): Promise<void> {
    const token = await this.getToken();
    const url = `${this.baseUrl}/api/v1/internal/webhooks`;

    logger.debug(
      { url, profileIds: request.profileIds },
      "Calling DP proxy anonymize webhook",
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error(
        { status: response.status, body, profileIds: request.profileIds },
        "DP proxy webhook call failed",
      );
      throw new Error(
        `DP proxy webhook failed with status ${response.status}: ${body}`,
      );
    }

    logger.info(
      { profileIds: request.profileIds },
      "DP proxy anonymize webhook called successfully",
    );
  }
}
