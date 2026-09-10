import fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import analyticsPlugin from "../../plugins/analytics-sdk.js";

const trackEvent = vi.fn();

vi.mock("../../utils/authentication-factory.js", () => ({
  getM2MAnalyticsSdk: vi.fn().mockResolvedValue({
    track: { event: (...args: unknown[]) => trackEvent(...args) },
  }),
}));

const buildApp = async () => {
  const app = fastify();
  await app.register(analyticsPlugin);
  app.get("/health", async () => ({}));
  app.get("/things", async () => ({}));
  await app.ready();
  return app;
};

describe("analytics-sdk plugin", () => {
  const savedEnv = { ...process.env };
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  beforeEach(() => {
    trackEvent.mockClear();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    process.env = { ...savedEnv };
  });

  it("does nothing when ANALYTICS_URL is not set", async () => {
    process.env.ANALYTICS_URL = " ";
    app = await buildApp();

    await app.inject({ method: "GET", url: "/things" });

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("tracks non-health requests", async () => {
    process.env.ANALYTICS_URL = "https://analytics.example";
    app = await buildApp();

    await app.inject({ method: "GET", url: "/things" });

    expect(trackEvent).toHaveBeenCalledWith({
      event: {
        action: "GET",
        category: "API",
        name: "/things",
        value: 1,
      },
    });
  });

  it("skips health endpoints", async () => {
    process.env.ANALYTICS_URL = "https://analytics.example";
    app = await buildApp();

    await app.inject({ method: "GET", url: "/health" });

    expect(trackEvent).not.toHaveBeenCalled();
  });
});
