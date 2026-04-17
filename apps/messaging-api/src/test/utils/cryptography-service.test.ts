import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { EnvEmailConfig } from "../../plugins/external/env.js";
import CryptographyService from "../../utils/cryptography-service.js";

describe("cryptography service", () => {
  const getMockEnvConfig = (): EnvEmailConfig => ({
    EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    EMAIL_PROVIDER_SMTP_HOST: "host",
    EMAIL_PROVIDER_SMTP_PORT: 587,
    EMAIL_PROVIDER_SMTP_USERNAME: "user",
    EMAIL_PROVIDER_SMTP_PASSWORD: "password",
    EMAIL_PROVIDER_SMTP_FROM_ADDRESS: "from@example.com",
    EMAIL_PROVIDER_SMTP_USE_SSL: true,
    WEBHOOK_URL_BASE: "http://example.com",
    EMAIL_PROVIDER_SMTP_TENANT_NAME: undefined,
  });

  it("should throw error if encryption key is empty", () => {
    const envConfig = getMockEnvConfig();
    envConfig.EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY = "";

    expect(() => new CryptographyService(envConfig)).toThrow();
  });

  it("should throw error if encryption key is not 32 chars long", () => {
    const envConfig = getMockEnvConfig();
    envConfig.EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY =
      randomBytes(16).toString("base64");

    expect(() => new CryptographyService(envConfig)).toThrow();
  });

  it("encrypt and decrypt returns the original text", () => {
    const envConfig = getMockEnvConfig();
    const cryptoService = new CryptographyService(envConfig);
    const text = "some text to encrypt";

    const encryptedText = cryptoService.encrypt(text);
    const decryptedText = cryptoService.decrypt(encryptedText);

    expect(decryptedText).toBe(text);
  });
});
