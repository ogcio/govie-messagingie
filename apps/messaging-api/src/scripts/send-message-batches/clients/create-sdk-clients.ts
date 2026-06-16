import { getBuildingBlockSDK } from "@ogcio/building-blocks-sdk";
import type {
  DeliveryEvent,
  MessagingClient,
  ProfileClient,
  ProfileMatch,
  PublicServantTokenClient,
  SendMessageRequest,
} from "../domain/types.js";
import { retryNonClientErrors } from "./retry-non-client-errors.js";

function getObjectRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value == null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getStringField(
  value: Record<string, unknown>,
  fieldName: string,
): string | null {
  const fieldValue = value[fieldName];
  return typeof fieldValue === "string" ? fieldValue : null;
}

function createSdkError(
  error: unknown,
  responseStatus?: number,
): Error & { status?: number; statusCode?: number; code?: string } {
  // When CloudFront / a proxy blocks the request, the SDK returns the raw HTML
  // body as a string instead of a JSON error object.  Surface it so callers can
  // see the actual gate-keeper response rather than a generic message.
  if (typeof error === "string") {
    const preview = error.slice(0, 200).replace(/\s+/gu, " ");
    const normalizedError = new Error(
      `SDK request failed: upstream returned non-JSON response: ${preview}`,
    ) as Error & { status?: number; statusCode?: number; code?: string };
    if (typeof responseStatus === "number") {
      normalizedError.status = responseStatus;
      normalizedError.statusCode = responseStatus;
    }
    return normalizedError;
  }

  const errorRecord = getObjectRecord(error);
  const detail = errorRecord ? getStringField(errorRecord, "detail") : null;
  const code = errorRecord ? getStringField(errorRecord, "code") : null;
  const statusCode =
    typeof responseStatus === "number"
      ? responseStatus
      : errorRecord && typeof errorRecord.statusCode === "number"
        ? errorRecord.statusCode
        : undefined;

  const normalizedError = new Error(
    detail ??
      (typeof statusCode === "number"
        ? `SDK request failed with status ${statusCode}`
        : "SDK request failed"),
  ) as Error & { status?: number; statusCode?: number; code?: string };

  if (typeof statusCode === "number") {
    normalizedError.status = statusCode;
    normalizedError.statusCode = statusCode;
  }

  if (typeof code === "string") {
    normalizedError.code = code;
  }

  return normalizedError;
}

function getEnvelopeData(value: unknown): unknown {
  const record = getObjectRecord(value);
  if (record == null || !("data" in record)) {
    return value;
  }

  return record.data;
}

function toProfileMatch(value: unknown): ProfileMatch | null {
  const record = getObjectRecord(value);
  if (record == null) {
    return null;
  }

  const profileId = getStringField(record, "id");
  const email = getStringField(record, "email");
  if (profileId == null || email == null) {
    return null;
  }

  const consentStatuses = getObjectRecord(record.consentStatuses);
  const messagingConsent = consentStatuses
    ? getObjectRecord(consentStatuses.messaging)
    : null;

  return {
    profileId,
    publicName: getStringField(record, "publicName"),
    email,
    consentStatus: messagingConsent
      ? getStringField(messagingConsent, "status")
      : null,
    profileStatus: getStringField(record, "status"),
  };
}

function toProfileMatches(value: unknown): ProfileMatch[] {
  const data = getEnvelopeData(value);

  if (Array.isArray(data)) {
    return data.flatMap((item) => {
      const profileMatch = toProfileMatch(item);
      return profileMatch == null ? [] : [profileMatch];
    });
  }

  const profileMatch = toProfileMatch(data);
  return profileMatch == null ? [] : [profileMatch];
}

function toDeliveryEvent(value: unknown): DeliveryEvent | null {
  const record = getObjectRecord(value);
  if (record == null) {
    return null;
  }

  const eventType = getStringField(record, "eventType");
  const eventStatus = getStringField(record, "eventStatus");
  const createdAt = getStringField(record, "createdAt");
  if (eventType == null || eventStatus == null || createdAt == null) {
    return null;
  }

  const eventPayload = getObjectRecord(record.data) ?? {};

  return {
    eventType,
    eventStatus,
    eventPayload,
    eventAt: new Date(createdAt),
  };
}

function toDeliveryEvents(value: unknown): DeliveryEvent[] {
  const data = getEnvelopeData(value);
  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((item) => {
    const deliveryEvent = toDeliveryEvent(item);
    return deliveryEvent == null ? [] : [deliveryEvent];
  });
}

function getSendRecipientUserId(request: SendMessageRequest): string {
  return request.recipientProfileId;
}

export function createSdkClients(params: {
  profileBackendUrl: string;
  messagingBackendUrl: string;
  tokenClient: PublicServantTokenClient;
  richTextEncodeBase64?: boolean;
}): {
  profile: ProfileClient;
  messaging: MessagingClient;
} {
  const sdk = getBuildingBlockSDK({
    services: {
      profile: { baseUrl: params.profileBackendUrl },
      messaging: { baseUrl: params.messagingBackendUrl },
    },
    getTokenFn: async (_serviceName: string) =>
      params.tokenClient.getAccessToken(),
  });

  const profile: ProfileClient = {
    async findProfile(normalizedEmail: string): Promise<ProfileMatch[]> {
      return retryNonClientErrors(async () => {
        const findProfileQuery = {
          email: normalizedEmail,
          consentSubjects: ["messaging"] as string[],
        };
        const response = await sdk.profile.findProfile(findProfileQuery);

        if (response.error) {
          throw createSdkError(response.error);
        }

        return toProfileMatches(response.data);
      });
    },
  };

  const messaging: MessagingClient = {
    async sendMessage(
      request: SendMessageRequest,
    ): Promise<{ messageId: string }> {
      const response = await sdk.messaging.send({
        preferredTransports: ["email"],
        recipientUserId: getSendRecipientUserId(request),
        security: "public",
        scheduleAt: request.scheduleAt.toISOString(),
        message: {
          threadName: request.content.threadName,
          subject: request.content.subject,
          excerpt: request.content.excerpt,
          plainText: request.content.plainText,
          // richText is optional in the API schema.  Omit it when the caller
          // has not provided HTML so that WAF XSS rules are not triggered by
          // HTML content in the request body.
          ...(request.content.richText
            ? {
                richText: params.richTextEncodeBase64
                  ? Buffer.from(request.content.richText, "utf8").toString(
                      "base64",
                    )
                  : request.content.richText,
              }
            : {}),
          language: "en",
        },
      });

      if (response.error) {
        throw createSdkError(response.error);
      }

      const sendData = getEnvelopeData(response.data);
      const sendDataRecord = getObjectRecord(sendData);
      const messageId = sendDataRecord
        ? getStringField(sendDataRecord, "id")
        : null;

      if (messageId == null) {
        throw new Error("Messaging send response did not include a message id");
      }

      return { messageId };
    },

    async getEventsForMessage(messageId: string): Promise<DeliveryEvent[]> {
      return retryNonClientErrors(async () => {
        const response = await sdk.messaging.getEventsForMessage(messageId);

        if (response.error) {
          throw createSdkError(response.error);
        }

        return toDeliveryEvents(response.data);
      });
    },
  };

  return { profile, messaging };
}
