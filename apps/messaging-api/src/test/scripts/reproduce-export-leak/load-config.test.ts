import { describe, expect, it } from "vitest";
import {
  KNOWN_ENVIRONMENTS,
  USER_DEFAULTS,
} from "../../../scripts/reproduce-export-leak/config/env-contract.js";
import { loadConfig } from "../../../scripts/reproduce-export-leak/config/load-config.js";
import type { CliCommand } from "../../../scripts/reproduce-export-leak/domain/types.js";

const seedCommand: CliCommand = {
  kind: "seed",
  symmetric: false,
  confirm: true,
};

const credentialEnv = {
  REPRO_ORGANIZATION_ID: "org-1",
  REPRO_MESSAGING_M2M_APP_ID: "m-app",
  REPRO_MESSAGING_M2M_APP_SECRET: "m-secret",
  REPRO_UPLOAD_M2M_APP_ID: "u-app",
  REPRO_UPLOAD_M2M_APP_SECRET: "u-secret",
  REPRO_PROFILE_M2M_APP_ID: "p-app",
  REPRO_PROFILE_M2M_APP_SECRET: "p-secret",
};

describe("reproduce-export-leak loadConfig", () => {
  it("resolves a known environment preset with default users", () => {
    const config = loadConfig({
      env: { ...credentialEnv, REPRO_ENV: "dev" },
      command: seedCommand,
    });

    expect(config.endpoints).toEqual({
      environmentLabel: "dev",
      uploadBaseUrl: KNOWN_ENVIRONMENTS.dev.uploadBaseUrl,
      messagingBaseUrl: KNOWN_ENVIRONMENTS.dev.messagingBaseUrl,
      profileBaseUrl: KNOWN_ENVIRONMENTS.dev.profileBaseUrl,
      logtoOidcEndpoint: KNOWN_ENVIRONMENTS.dev.logtoOidcEndpoint,
    });
    expect(config.user1).toBe(USER_DEFAULTS.dev.user1);
    expect(config.user2).toBe(USER_DEFAULTS.dev.user2);
    expect(config.messagingM2M).toEqual({
      applicationId: "m-app",
      applicationSecret: "m-secret",
    });
  });

  it("lets explicit base URLs take precedence and normalizes the OIDC trailing slash", () => {
    const config = loadConfig({
      env: {
        ...credentialEnv,
        REPRO_UPLOAD_BASE_URL: "https://upload.custom.example",
        REPRO_MESSAGING_BASE_URL: "https://messaging.custom.example",
        REPRO_PROFILE_BASE_URL: "https://profile.custom.example",
        REPRO_LOGTO_OIDC_ENDPOINT: "https://auth.custom.example/oidc",
        REPRO_USER1: "custom-user-1",
        REPRO_USER2: "custom-user-2",
      },
      command: seedCommand,
    });

    expect(config.endpoints.environmentLabel).toBe("custom");
    expect(config.endpoints.logtoOidcEndpoint).toBe(
      "https://auth.custom.example/oidc/",
    );
    expect(config.user1).toBe("custom-user-1");
  });

  it("refuses to run when NODE_ENV is production", () => {
    expect(() =>
      loadConfig({
        env: { ...credentialEnv, REPRO_ENV: "dev", NODE_ENV: "production" },
        command: seedCommand,
      }),
    ).toThrow(/Refusing to run/);
  });

  it("refuses production-like hosts even with valid config", () => {
    expect(() =>
      loadConfig({
        env: {
          ...credentialEnv,
          REPRO_UPLOAD_BASE_URL: "https://upload.prod.example",
          REPRO_MESSAGING_BASE_URL: "https://messaging.custom.example",
          REPRO_PROFILE_BASE_URL: "https://profile.custom.example",
          REPRO_LOGTO_OIDC_ENDPOINT: "https://auth.custom.example/oidc/",
          REPRO_USER1: "u1",
          REPRO_USER2: "u2",
        },
        command: seedCommand,
      }),
    ).toThrow(/looks production-like/);
  });

  it("aggregates missing credential and user problems", () => {
    expect(() =>
      loadConfig({ env: { REPRO_ENV: "dev" }, command: seedCommand }),
    ).toThrow(
      /REPRO_ORGANIZATION_ID is required[\s\S]*REPRO_MESSAGING_M2M_APP_ID is required/,
    );
  });

  it("requires users when no default exists for a custom environment", () => {
    expect(() =>
      loadConfig({
        env: {
          ...credentialEnv,
          REPRO_UPLOAD_BASE_URL: "https://upload.custom.example",
          REPRO_MESSAGING_BASE_URL: "https://messaging.custom.example",
          REPRO_PROFILE_BASE_URL: "https://profile.custom.example",
          REPRO_LOGTO_OIDC_ENDPOINT: "https://auth.custom.example/oidc/",
        },
        command: seedCommand,
      }),
    ).toThrow(/REPRO_USER1 is required[\s\S]*REPRO_USER2 is required/);
  });

  it("rejects an unknown REPRO_ENV", () => {
    expect(() =>
      loadConfig({
        env: { ...credentialEnv, REPRO_ENV: "staging" },
        command: seedCommand,
      }),
    ).toThrow(/REPRO_ENV must be one of dev\|uat/);
  });

  it("requires either REPRO_ENV or explicit base URLs", () => {
    expect(() =>
      loadConfig({ env: { ...credentialEnv }, command: seedCommand }),
    ).toThrow(/either REPRO_ENV \(dev\|uat\) or the explicit/);
  });

  it("rejects invalid explicit URLs", () => {
    expect(() =>
      loadConfig({
        env: {
          ...credentialEnv,
          REPRO_UPLOAD_BASE_URL: "not-a-url",
          REPRO_MESSAGING_BASE_URL: "https://messaging.custom.example",
          REPRO_PROFILE_BASE_URL: "https://profile.custom.example",
          REPRO_LOGTO_OIDC_ENDPOINT: "https://auth.custom.example/oidc/",
          REPRO_USER1: "u1",
          REPRO_USER2: "u2",
        },
        command: seedCommand,
      }),
    ).toThrow(/REPRO_UPLOAD_BASE_URL must be a valid URL/);
  });
});
