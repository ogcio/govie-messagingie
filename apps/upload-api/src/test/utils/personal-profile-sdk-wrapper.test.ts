import type { FastifyBaseLogger } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getProfile = vi.fn();

vi.mock("../../utils/authentication-factory.js", () => ({
  getPersonalProfileSdk: () => Promise.resolve({ getProfile }),
}));

import { PersonalProfileSdkWrapper } from "../../utils/personal-profile-sdk-wrapper.js";

const buildWrapper = () =>
  new PersonalProfileSdkWrapper({} as FastifyBaseLogger, {
    userId: "user-1",
    accessToken: "token",
  });

describe("PersonalProfileSdkWrapper", () => {
  beforeEach(() => {
    getProfile.mockReset();
  });

  describe("getProfile", () => {
    it("returns the profile data", async () => {
      getProfile.mockResolvedValue({ data: { id: "user-1" } });

      const profile = await buildWrapper().getProfile("user-1");

      expect(profile).toEqual({ id: "user-1" });
      expect(getProfile).toHaveBeenCalledWith("user-1");
    });

    it("throws 503 when the sdk returns an error", async () => {
      getProfile.mockResolvedValue({
        error: { detail: "upstream broken" },
      });

      await expect(buildWrapper().getProfile("user-1")).rejects.toMatchObject({
        statusCode: 503,
        message: expect.stringContaining("upstream broken"),
      });
    });

    it("throws 404 when no profile is found", async () => {
      getProfile.mockResolvedValue({ data: undefined });

      await expect(buildWrapper().getProfile("user-1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("getLinkedProfileIds", () => {
    it("returns ids of linked profiles", async () => {
      getProfile.mockResolvedValue({
        data: { id: "user-1", linkedProfiles: [{ id: "a" }, { id: "b" }] },
      });

      expect(await buildWrapper().getLinkedProfileIds("user-1")).toEqual([
        "a",
        "b",
      ]);
    });

    it("returns an empty array when there are no linked profiles", async () => {
      getProfile.mockResolvedValue({ data: { id: "user-1" } });

      expect(await buildWrapper().getLinkedProfileIds("user-1")).toEqual([]);
    });
  });
});
