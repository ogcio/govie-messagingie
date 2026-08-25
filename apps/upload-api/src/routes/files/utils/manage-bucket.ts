import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import type { FastifyBaseLogger } from "fastify";
import type { S3ClientConfig } from "../../../types/s3Client.js";

export async function canConnect(
  s3ClientConfig: S3ClientConfig,
  logger: FastifyBaseLogger,
): Promise<boolean> {
  try {
    await doesBucketExist(s3ClientConfig, logger);
    return true;
  } catch (e) {
    logger.warn({ parent: e }, "Error connecting to S3.");
    return false;
  }
}

export async function createBucketIfNotExists(
  s3ClientConfig: S3ClientConfig,
  logger: FastifyBaseLogger,
): Promise<void> {
  if (await doesBucketExist(s3ClientConfig, logger)) {
    return;
  }

  try {
    await s3ClientConfig.client.send(
      new CreateBucketCommand({
        Bucket: s3ClientConfig.bucketName,
      }),
    );
  } catch (e) {
    logger.error({ error: e }, "Error creating S3 bucket");
    throw new Error("Error creating bucket");
  }
}

async function doesBucketExist(
  s3ClientConfig: S3ClientConfig,
  logger: FastifyBaseLogger,
): Promise<boolean> {
  try {
    await s3ClientConfig.client.send(
      new HeadBucketCommand({
        Bucket: s3ClientConfig.bucketName,
      }),
    );

    return true;
  } catch (e) {
    if (isS3SdkError(e) && e.$metadata.httpStatusCode === 404) {
      return false;
    }
    logger.error({ error: e }, "Error checking if bucket exists");
    throw new Error("Error checking if bucket exists");
  }
}

export async function ensureS3Connectivity(
  s3ClientConfig: S3ClientConfig,
  logger: FastifyBaseLogger,
): Promise<void> {
  if (!(await canConnect(s3ClientConfig, logger))) {
    throw new Error("Can't connect to s3");
  }
}

function isS3SdkError(
  e: unknown,
): e is { $metadata: { httpStatusCode?: number } } {
  return (
    typeof e === "object" &&
    e !== null &&
    "$metadata" in e &&
    typeof e.$metadata === "object" &&
    e.$metadata !== null
  );
}
