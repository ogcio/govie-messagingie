import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { LogtoClient } from "~/clients/logto.js";
import {
  ONBOARDED_CITIZEN_ROLE_ID,
  ONBOARDING_CANDIDATE_ROLE_ID,
} from "~/const/logto.js";
import { buildOnce } from "~/test/test-server-builder.js";

describe("POST /api/v1/onboarding", () => {
  let app: FastifyInstance;
  let setAuth: (config: {
    userId: string;
    hasOnboardingPermissions?: boolean;
  }) => void;

  const assignUserRole = vi.fn().mockResolvedValue(undefined);
  const removeUserRole = vi.fn().mockResolvedValue(undefined);
  const getUserSignInLogs = vi.fn();
  const getUser = vi.fn();

  beforeAll(async () => {
    const built = await buildOnce();
    app = built.app;
    setAuth = built.setAuth;

    app.getLogtoClient = () =>
      Promise.resolve({
        assignUserRole,
        removeUserRole,
        getUserSignInLogs,
        getUser,
      } as unknown as LogtoClient);
  });

  afterAll(async () => {
    await app.close();
  });

  it("assigns onboarded-citizen and revokes onboarding-candidate when SAFE ≥ 2", async () => {
    assignUserRole.mockClear();
    removeUserRole.mockClear();
    getUserSignInLogs.mockResolvedValue([
      {
        payload: {
          interaction: {
            verificationRecords: [
              {
                connectorId: "mygovid",
                socialUserInfo: { rawData: { DSPOnlineLevel: 2 } },
              },
            ],
          },
        },
      },
    ]);
    getUser.mockResolvedValue(undefined);

    setAuth({
      userId: "citizen-1",
      hasOnboardingPermissions: true,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/onboarding",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, safeLevel: 2 });
    expect(assignUserRole).toHaveBeenCalledWith(
      "citizen-1",
      ONBOARDED_CITIZEN_ROLE_ID,
    );
    expect(removeUserRole).toHaveBeenCalledWith(
      "citizen-1",
      ONBOARDING_CANDIDATE_ROLE_ID,
    );
  });

  it("still revokes onboarding-candidate when onboarded-citizen is already assigned (legacy flow)", async () => {
    assignUserRole.mockClear();
    removeUserRole.mockClear();
    getUserSignInLogs.mockResolvedValue([
      {
        payload: {
          interaction: {
            verificationRecords: [
              {
                connectorId: "mygovid",
                socialUserInfo: { rawData: { DSPOnlineLevel: 2 } },
              },
            ],
          },
        },
      },
    ]);

    setAuth({
      userId: "legacy-citizen",
      hasOnboardingPermissions: true,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/onboarding",
    });

    expect(response.statusCode).toBe(200);
    expect(assignUserRole).toHaveBeenCalledWith(
      "legacy-citizen",
      ONBOARDED_CITIZEN_ROLE_ID,
    );
    expect(removeUserRole).toHaveBeenCalledWith(
      "legacy-citizen",
      ONBOARDING_CANDIDATE_ROLE_ID,
    );
  });

  it("returns 403 when SAFE level is below 2", async () => {
    assignUserRole.mockClear();
    removeUserRole.mockClear();
    getUserSignInLogs.mockResolvedValue([
      {
        payload: {
          interaction: {
            verificationRecords: [
              {
                connectorId: "mygovid",
                socialUserInfo: { rawData: { DSPOnlineLevel: 1 } },
              },
            ],
          },
        },
      },
    ]);

    setAuth({
      userId: "low-safe",
      hasOnboardingPermissions: true,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/onboarding",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "SAFE level 1 is below the required level 2",
      safeLevel: 1,
      required: 2,
    });
    expect(assignUserRole).not.toHaveBeenCalled();
    expect(removeUserRole).not.toHaveBeenCalled();
  });
});
