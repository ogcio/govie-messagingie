import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import type { FastifyBaseLogger } from "fastify";
import { describe, expect, it, vi } from "vitest";
import {
  canConnect,
  createBucketIfNotExists,
  ensureS3Connectivity,
} from "../../../../routes/files/utils/manage-bucket.js";
import type { S3ClientConfig } from "../../../../types/s3Client.js";

const buildLogger = () =>
  ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }) as unknown as FastifyBaseLogger;

const buildS3Config = (send: ReturnType<typeof vi.fn>): S3ClientConfig =>
  ({
    client: { send },
    bucketName: "test-bucket",
  }) as unknown as S3ClientConfig;

const notFoundError = () => {
  const err = new Error("not found") as Error & {
    $metadata: { httpStatusCode: number };
  };
  err.$metadata = { httpStatusCode: 404 };
  return err;
};

describe("manage-bucket", () => {
  describe("canConnect", () => {
    it("returns true when the bucket exists", async () => {
      const send = vi.fn().mockResolvedValue({});
      expect(await canConnect(buildS3Config(send), buildLogger())).toBe(true);
      expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
    });

    it("returns true when the bucket does not exist but S3 responds", async () => {
      const send = vi.fn().mockRejectedValue(notFoundError());
      expect(await canConnect(buildS3Config(send), buildLogger())).toBe(true);
    });

    it("returns false when S3 is unreachable", async () => {
      const send = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      const logger = buildLogger();
      expect(await canConnect(buildS3Config(send), logger)).toBe(false);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe("createBucketIfNotExists", () => {
    it("does nothing when the bucket already exists", async () => {
      const send = vi.fn().mockResolvedValue({});
      await createBucketIfNotExists(buildS3Config(send), buildLogger());
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
    });

    it("creates the bucket when it does not exist", async () => {
      const send = vi
        .fn()
        .mockRejectedValueOnce(notFoundError())
        .mockResolvedValueOnce({});
      await createBucketIfNotExists(buildS3Config(send), buildLogger());
      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1][0]).toBeInstanceOf(CreateBucketCommand);
    });

    it("throws when bucket creation fails", async () => {
      const send = vi
        .fn()
        .mockRejectedValueOnce(notFoundError())
        .mockRejectedValueOnce(new Error("denied"));
      await expect(
        createBucketIfNotExists(buildS3Config(send), buildLogger()),
      ).rejects.toThrow("Error creating bucket");
    });

    it("throws when the existence check fails with a non-404 error", async () => {
      const send = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      await expect(
        createBucketIfNotExists(buildS3Config(send), buildLogger()),
      ).rejects.toThrow("Error checking if bucket exists");
    });
  });

  describe("ensureS3Connectivity", () => {
    it("resolves when S3 is reachable", async () => {
      const send = vi.fn().mockResolvedValue({});
      await expect(
        ensureS3Connectivity(buildS3Config(send), buildLogger()),
      ).resolves.toBeUndefined();
    });

    it("throws when S3 is unreachable", async () => {
      const send = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      await expect(
        ensureS3Connectivity(buildS3Config(send), buildLogger()),
      ).rejects.toThrow("Can't connect to s3");
    });
  });
});
