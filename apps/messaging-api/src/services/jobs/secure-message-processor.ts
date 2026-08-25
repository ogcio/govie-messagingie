import { httpErrors } from "@fastify/sensible";
import type { MessageToDeliver } from "../../types/messages.js";
import type { I18n } from "../../utils/i18n.js";
import type {
  GetOrganisationResponse,
  GetProfileResponse,
} from "../users/profile-sdk-wrapper.js";

/**
 * Appends Matomo campaign attribution to the citizen-facing message link so
 * email-referred portal visits are measurable (AB: usage instrumentation).
 * mtm_keyword carries the sender organisation id — no citizen PII.
 * Never throws: a malformed template must not break email delivery.
 */
export function appendCampaignParams(
  url: string,
  organisationId: string,
): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("mtm_campaign", "message-notification");
    parsed.searchParams.set("mtm_source", "email");
    parsed.searchParams.set("mtm_keyword", organisationId);
    return parsed.toString();
  } catch {
    return url;
  }
}

export function prepareForSecureDelivery({
  profile,
  messageToDeliver,
  i18n,
  organisation,
}: {
  profile: GetProfileResponse;
  messageToDeliver: MessageToDeliver;
  i18n: I18n;
  organisation: NonNullable<GetOrganisationResponse>["data"];
}): MessageToDeliver & { transports: string[] } {
  if (messageToDeliver.securityLevel === "public") {
    return {
      ...messageToDeliver,
      transports: messageToDeliver.transports ?? [],
    };
  }

  const cloned = { ...messageToDeliver };
  cloned.attachmentIds = undefined;

  const secureFields = getSecureFields({
    profile,
    messageToDeliver,
    i18n,
    organisation,
  });

  cloned.body = secureFields.textBody;
  cloned.richText = secureFields.htmlBody;
  cloned.subject = secureFields.subject;
  cloned.excerpt = secureFields.excerpt;

  return { ...cloned, transports: cloned.transports ?? [] };
}

function getSecureFields({
  profile,
  messageToDeliver,
  i18n,
  organisation,
}: {
  profile: GetProfileResponse;
  messageToDeliver: MessageToDeliver;
  i18n: I18n;
  organisation: NonNullable<GetOrganisationResponse>["data"];
}): { htmlBody: string; textBody: string; subject: string; excerpt: string } {
  if (!process.env.MESSAGING_SECURE_MESSAGE_URL) {
    throw httpErrors.internalServerError(
      "Missing MESSAGING_SECURE_MESSAGE_URL variable",
    );
  }

  const seeMessageUrl = appendCampaignParams(
    process.env.MESSAGING_SECURE_MESSAGE_URL.replace(
      "{{language}}",
      profile.preferredLanguage,
    ).replace("{{messageId}}", messageToDeliver.id),
    organisation.id,
  );

  const enOrganizationName = organisation.translations.en.name;
  const gaOrganizationName = organisation.translations.ga.name;

  const htmlBody = i18n.translate(
    profile.preferredLanguage,
    "secureMessageHtml",
    {
      publicName: profile.publicName,
      gaOrganizationName,
      enOrganizationName,
      showMessageUrl: seeMessageUrl,
    },
  );
  const textBody = i18n.translate(
    profile.preferredLanguage,
    "secureMessageText",
    {
      publicName: profile.publicName,
      showMessageUrl: seeMessageUrl,
      enOrganizationName,
      gaOrganizationName,
    },
  );

  const subject = i18n.translate(
    profile.preferredLanguage,
    "secureMessageSubject",
    { enOrganizationName, gaOrganizationName },
  );

  const excerpt = i18n.translate(
    profile.preferredLanguage,
    "secureMessageExcerpt",
    { enOrganizationName, gaOrganizationName },
  );

  return { excerpt, subject, textBody, htmlBody };
}
