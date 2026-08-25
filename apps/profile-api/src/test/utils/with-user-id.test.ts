import { describe, expect, it, vi } from "vitest";
import { withUserId } from "~/utils/with-user-id.js";

vi.mock("@fastify/sensible", () => ({
  httpErrors: {
    forbidden: vi.fn((message) => new Error(message)),
  },
}));

describe("withUserId", () => {
  it("should return user id when present", () => {
    const request = {
      userData: {
        userId: "user-123",
      },
    };

    const result = withUserId(request);
    expect(result).toBe("user-123");
  });

  it("should throw forbidden error when userData is undefined", () => {
    const request = {};

    expect(() => withUserId(request)).toThrow("User id is not set");
  });

  it("should throw forbidden error when userId is undefined", () => {
    const request = {
      userData: {},
    };

    expect(() => withUserId(request)).toThrow("User id is not set");
  });

  it("should throw forbidden error when userId is empty", () => {
    const request = {
      userData: {
        userId: "",
      },
    };

    expect(() => withUserId(request)).toThrow("User id is not set");
  });
});
