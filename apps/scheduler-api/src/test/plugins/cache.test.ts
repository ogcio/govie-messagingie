import fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import cache from "../../plugins/cache.js";

describe("cache plugin", () => {
  let app: ReturnType<typeof fastify> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("decorates the instance with a working node cache", async () => {
    app = fastify();
    await app.register(cache);
    await app.ready();

    expect(app.nodeCache).toBeDefined();
    app.nodeCache.set("key", "value");
    expect(app.nodeCache.get("key")).toBe("value");
    expect(app.nodeCache.has("missing")).toBe(false);
  });
});
