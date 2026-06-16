import { describe, expect, it, vi } from "vitest";
import { createPublicServantTokenClient } from "../../../scripts/send-message-batches/clients/public-servant-token-client.js";

describe("createPublicServantTokenClient", () => {
  it("requests a token once and reuses the cached token", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "token-1", expires_in: 3600 }),
    });

    const client = createPublicServantTokenClient({
      tokenEndpoint: "https://logto.example/oidc/token",
      clientId: "client-id",
      clientSecret: "client-secret",
      organizationId: "org-1",
      scopes: "profile:user:read messaging:message:*",
      fetchFn,
      now: () => new Date("2026-05-26T10:00:00.000Z"),
    });

    expect(await client.getAccessToken()).toBe("token-1");
    expect(await client.getAccessToken()).toBe("token-1");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
