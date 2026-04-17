import type { FastifyBaseLogger } from "fastify";
import { ParseError, parsePhoneNumberWithError } from "libphonenumber-js";
import type { EnvConfig } from "../../plugins/external/env.js";
import { DEFAULT_LANGUAGE } from "../../types/schemaDefinitions.js";
import type { I18n } from "../../utils/i18n.js";
import type {
  GetOrganisationResponse,
  GetProfileResponse,
} from "../users/profile-sdk-wrapper.js";
import type { SmsTransport } from "./sms-transport.js";

export class SmsSender {
  private readonly organizationId: string;
  private phoneNumber: string | undefined;
  private parsedPhoneNumber: string | undefined = undefined;
  private parsingError: string | undefined;
  private readonly smsEnabled: boolean;
  private alreadyParsed = false;
  private readonly defaultCountry = "IE";
  private readonly defaultFormat = "E.164";
  private readonly defaultDestinationCountryCode = "+353";
  private readonly smsContent: string;

  constructor(
    private readonly params: {
      profile: GetProfileResponse;
      getTransport: () => SmsTransport;
      organizationId: string;
      logger: FastifyBaseLogger;
      config: EnvConfig;
      i18n: I18n;
      organisation: NonNullable<GetOrganisationResponse>["data"];
    },
  ) {
    this.organizationId = this.params.organizationId;
    this.phoneNumber = this.params.profile.details?.phone;
    this.setValidatedPhoneNumber();
    this.smsEnabled = !!(
      this.params.config.SNS_REGION &&
      this.params.config.SNS_REGION.length > 0 &&
      this.params.config.SNS_ALLOWED_ORGANIZATIONS?.split(",").includes(
        this.organizationId,
      ) &&
      this.parsedPhoneNumber?.startsWith(this.defaultDestinationCountryCode)
    );
    this.smsContent = this.params.i18n.translate(
      this.params.profile.preferredLanguage ?? DEFAULT_LANGUAGE,
      "smsText",
      {
        enOrganizationName: this.params.organisation.translations.en.shortName,
        gaOrganizationName: this.params.organisation.translations.ga.shortName,
      },
    );
  }

  private setValidatedPhoneNumber(): string | undefined {
    if (this.alreadyParsed) return;

    this.alreadyParsed = true;
    if (!this.phoneNumber) {
      this.parsingError = "User has no phone number set";
      this.params.logger.error(
        {
          profileId: this.params.profile.id,
          organizationId: this.organizationId,
        },
        this.parsingError,
      );
      return;
    }
    const { number, error } = this.getParsedPhoneNumber(this.phoneNumber);
    if (error) {
      this.parsingError = error;
      this.params.logger.error(
        {
          profileId: this.params.profile.id,
          error,
          organizationId: this.organizationId,
        },
        this.parsingError,
      );
      return;
    }
    this.params.logger.info(
      {
        profileId: this.params.profile.id,
        organizationId: this.organizationId,
      },
      "Phone number parsed successfully",
    );
    this.parsedPhoneNumber = number;
  }

  private getParsedPhoneNumber(phoneNumber: string): {
    number: string | undefined;
    error: string | undefined;
  } {
    try {
      const number = parsePhoneNumberWithError(phoneNumber, {
        defaultCountry: this.defaultCountry,
      }).format(this.defaultFormat);
      return {
        number,
        error: undefined,
      };
    } catch (error) {
      let errorMessage = "Unknown error";
      if (error instanceof ParseError) {
        errorMessage = "Invalid phone number";
      }
      if (error instanceof Error) {
        errorMessage = "Error parsing phone number";
      }
      return {
        number: undefined,
        error: errorMessage,
      };
    }
  }

  public async send(): Promise<boolean> {
    if (!this.smsEnabled) {
      this.params.logger.info(
        {
          profileId: this.params.profile.id,
          organizationId: this.organizationId,
        },
        "Cannot send SMS because SMS is not enabled or phone number is not valid",
      );
      return false;
    }

    try {
      const transport = this.params.getTransport();
      const result = await transport.sendSms(
        this.smsContent,
        this.parsedPhoneNumber as string,
      );
      if (!result.messageId) {
        this.params.logger.error(
          {
            result,
            profileId: this.params.profile.id,
            organizationId: this.organizationId,
          },
          "Error sending SMS",
        );
        return false;
      }

      this.params.logger.info(
        {
          result,
          profileId: this.params.profile.id,
          organizationId: this.organizationId,
        },
        "SMS sent successfully",
      );
      return true;
    } catch (error) {
      this.params.logger.error(
        {
          error,
          profileId: this.params.profile.id,
          organizationId: this.organizationId,
        },
        "Error sending SMS",
      );
      return false;
    }
  }
}
