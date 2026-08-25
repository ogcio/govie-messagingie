import fastifyEnv from "@fastify/env";
import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { envSchema } from "../../../config.js";
import s3Client from "../../../plugins/s3Client.js";

vi.mock("../../../routes/files/utils/manage-bucket.js", () => ({
  canConnect: vi.fn().mockResolvedValue(true),
  createBucketIfNotExists: vi.fn().mockResolvedValue(undefined),
}));

describe("s3Plugin", () => {
  it("registers s3 plugin with credentials", async () => {
    const app = fastify();

    await app.register(fastifyEnv, {
      schema: envSchema,
      dotenv: { quiet: true },
    });

    await app.register(s3Client);

    expect(app.s3Client.config).toHaveProperty("credentials");

    expect(app.s3Client.config.credentials).toMatchObject({
      accessKeyId: "123",
      secretAccessKey: "432",
    });
  });

  it("registers s3 plugin without credentials", async () => {
    const app = fastify();

    await app.register(fastifyEnv, {
      schema: envSchema,
      dotenv: { quiet: true },
    });

    delete app.config.S3_ACCESS_KEY_ID;

    await app.register(s3Client);

    expect(app.s3Client.config.credentials).toBeUndefined();
  });
});
