import { describe, expect, it, vi } from "vitest";

const instrumentNode = vi.fn().mockResolvedValue(undefined);

vi.mock("@ogcio/o11y-sdk-node", () => ({
  instrumentNode: (...args: unknown[]) => instrumentNode(...args),
}));

vi.mock("@fastify/otel", () => ({
  FastifyOtelInstrumentation: class {},
}));

describe("instrumentation", () => {
  it("configures the otel sdk on import without throwing", async () => {
    await expect(import("../instrumentation.js")).resolves.not.toThrow();

    expect(instrumentNode).toHaveBeenCalledWith(
      expect.objectContaining({
        ignoreUrls: [
          { type: "equals", url: "/health" },
          { type: "equals", url: "/health/ready" },
        ],
      }),
    );
  });
});
