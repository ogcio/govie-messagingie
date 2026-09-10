import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogtoClient, LogtoError } from "~/clients/logto.js";

describe("LogtoClient methods", () => {
  let client: LogtoClient;
  const baseUrl = "https://api.logto.com";
  const token = "test-token";

  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    client = new LogtoClient(baseUrl, token);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const okResponse = (payload: unknown) => ({
    ok: true,
    json: () => Promise.resolve(payload),
  });

  describe("getUser / getUserRoles / getOrganization", () => {
    it("fetches a user by id", async () => {
      const user = { id: "user-1", primaryEmail: "user@example.com" };
      mockFetch.mockResolvedValueOnce(okResponse(user));

      const result = await client.getUser("user-1");
      expect(result).toEqual(user);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/users/user-1`,
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("fetches roles for a user", async () => {
      const roles = [{ id: "role-1", name: "admin" }];
      mockFetch.mockResolvedValueOnce(okResponse(roles));

      const result = await client.getUserRoles("user-1");
      expect(result).toEqual(roles);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/users/user-1/roles`,
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("fetches an organization", async () => {
      const organization = { id: "org-1", name: "Org" };
      mockFetch.mockResolvedValueOnce(okResponse(organization));

      const result = await client.getOrganization("org-1");
      expect(result).toEqual(organization);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/organizations/org-1`,
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  describe("error mapping", () => {
    const errorCases: Array<[number, string]> = [
      [403, "Insufficient permissions"],
      [404, "Resource not found"],
      [422, "Invalid request data"],
    ];

    for (const [status, message] of errorCases) {
      it(`maps ${status} responses`, async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status,
          json: () => Promise.resolve({}),
        });
        await expect(client.getUser("user-1")).rejects.toThrow(
          new LogtoError(message, status, {}),
        );
      });
    }

    it("maps unknown statuses and retries server errors", async () => {
      vi.useFakeTimers();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({}),
      });
      const promise = client.getUser("user-1");
      promise.catch(() => {});
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow(
        new LogtoError("Unknown error occurred", 502, {}),
      );
      expect(mockFetch.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe("getUserSignInLogs", () => {
    it("returns logs on success", async () => {
      const logs = [{ id: "log-1" }];
      mockFetch.mockResolvedValueOnce(okResponse(logs));

      const result = await client.getUserSignInLogs("user-1");
      expect(result).toEqual(logs);
    });

    it("returns an empty array on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await client.getUserSignInLogs("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("assignUserRole", () => {
    it("assigns a role", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({}));
      await client.assignUserRole("user-1", "role-1");
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/users/user-1/roles`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ roleIds: ["role-1"] }),
        }),
      );
    });

    it("treats 409 as success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({}),
      });
      await expect(
        client.assignUserRole("user-1", "role-1"),
      ).resolves.toBeUndefined();
    });

    it("throws on other errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("no body")),
      });
      await expect(client.assignUserRole("user-1", "role-1")).rejects.toThrow(
        LogtoError,
      );
    });
  });

  describe("deleteUser", () => {
    it("deletes a user", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await client.deleteUser("user-1");
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/users/user-1`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("throws when deletion fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.reject(new Error("no body")),
      });
      await expect(client.deleteUser("user-1")).rejects.toThrow(
        "Failed to delete user with ID user-1",
      );
    });
  });

  describe("removeUserRole", () => {
    it("removes a role", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({}));
      await client.removeUserRole("user-1", "role-1");
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/users/user-1/roles/role-1`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("treats 404 as success (idempotent)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });
      await expect(
        client.removeUserRole("user-1", "role-1"),
      ).resolves.toBeUndefined();
    });

    it("throws on other errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "boom" }),
      });
      await expect(client.removeUserRole("user-1", "role-1")).rejects.toThrow(
        LogtoError,
      );
    });
  });
});
