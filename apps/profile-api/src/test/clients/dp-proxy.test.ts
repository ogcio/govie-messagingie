import pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DPProxyClient } from "~/clients/dp-proxy.js";

const logger = pino({ enabled: false });
const mockFetch = vi.fn();

describe("DPProxyClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strips a trailing slash from the base url and posts the webhook", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const client = new DPProxyClient({
      baseUrl: "https://dp.example/",
      getToken: () => "static-token",
    });

    await client.anonymizeUser(
      { event: "anonymize_user", profileIds: ["p1"] },
      logger,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://dp.example/api/v1/internal/webhooks",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "static-token" }),
        body: JSON.stringify({ event: "anonymize_user", profileIds: ["p1"] }),
      }),
    );
  });

  it("supports async token providers", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const client = new DPProxyClient({
      baseUrl: "https://dp.example",
      getToken: async () => "async-token",
    });

    await client.anonymizeUser(
      { event: "anonymize_user", profileIds: ["p1"] },
      logger,
    );

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("async-token");
  });

  it("throws with status and body when the webhook call fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve("bad gateway"),
    });
    const client = new DPProxyClient({
      baseUrl: "https://dp.example",
      getToken: () => "t",
    });

    await expect(
      client.anonymizeUser(
        { event: "anonymize_user", profileIds: ["p1"] },
        logger,
      ),
    ).rejects.toThrow("DP proxy webhook failed with status 502: bad gateway");
  });

  it("still throws when the error body cannot be read", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error("stream closed")),
    });
    const client = new DPProxyClient({
      baseUrl: "https://dp.example",
      getToken: () => "t",
    });

    await expect(
      client.anonymizeUser(
        { event: "anonymize_user", profileIds: ["p1"] },
        logger,
      ),
    ).rejects.toThrow("DP proxy webhook failed with status 500");
  });
});
