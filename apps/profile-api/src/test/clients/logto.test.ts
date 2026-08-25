import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogtoClient, LogtoError } from "~/clients/logto.js";

describe("LogtoClient", () => {
  let client: LogtoClient;
  const baseUrl = "https://api.logto.com";
  const token = "test-token";

  // Mock global fetch
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new LogtoClient(baseUrl, token);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should remove trailing slash from baseUrl", () => {
      const clientWithSlash = new LogtoClient("https://api.logto.com/", token);
      expect(mockFetch).not.toHaveBeenCalled();

      // Test by making a request
      clientWithSlash.createUser({
        primaryEmail: "test@example.com",
        username: "test",
        name: "Test User",
        customData: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.logto.com/users",
        expect.any(Object),
      );
    });

    it("should set authorization header with token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "user-123" }),
      });

      await client.createUser({
        primaryEmail: "test@example.com",
        username: "test",
        name: "Test User",
        customData: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }),
        }),
      );
    });
  });

  describe("createUser", () => {
    const userData = {
      primaryEmail: "test@example.com",
      username: "test",
      name: "Test User",
      customData: { organizationId: "org-123" },
    };

    it("should create user successfully", async () => {
      const expectedResponse = {
        id: "user-123",
        primaryEmail: userData.primaryEmail,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(expectedResponse),
      });

      const result = await client.createUser(userData);

      expect(result).toEqual(expectedResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/users`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(userData),
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should retry on network errors", async () => {
      const expectedResponse = {
        id: "user-123",
        primaryEmail: userData.primaryEmail,
      };

      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(expectedResponse),
      });

      const promise = client.createUser(userData);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(expectedResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle 400 error", async () => {
      const errorBody = {
        message: "Invalid email format",
        code: "INVALID_EMAIL",
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorBody),
      });

      await expect(client.createUser(userData)).rejects.toThrow(
        new LogtoError("Invalid request parameters", 400, errorBody),
      );
    });

    it("should handle 401 error", async () => {
      const errorBody = {
        message: "Invalid token",
        code: "INVALID_TOKEN",
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve(errorBody),
      });

      await expect(client.createUser(userData)).rejects.toThrow(
        new LogtoError("Authentication required", 401, errorBody),
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const promise = client.createUser(userData);
      promise.catch(() => {});
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow("Network error");
    });

    it("should handle invalid JSON response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const promise = client.createUser(userData);
      promise.catch(() => {});
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow("Invalid JSON");
    });
  });

  describe("LogtoError", () => {
    it("should create error with message, status and body", () => {
      const errorBody = { message: "Test error", code: "TEST_ERROR" };
      const error = new LogtoError("Test message", 400, errorBody);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Test message");
      expect(error.status).toBe(400);
      expect(error.body).toEqual(errorBody);
    });
  });
});
