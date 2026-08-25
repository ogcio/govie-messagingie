import type { PostgresDb } from "@fastify/postgres";
import { httpErrors } from "@fastify/sensible";
import fastify, { type FastifyInstance } from "fastify";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { ensureS3Connectivity } from "../../routes/files/utils/manage-bucket.js";
import healthcheck from "../../routes/healthcheck.js";
import type { S3ClientConfig } from "../../types/s3Client.js";
import { getPackageInfo } from "../../utils/get-package-info.js";

const EXPECTED_PACKAGE_NAME = "upload-api";
const EXPECTED_PACKAGE_VERSION = "1.0.0";

vi.mock("../../utils/get-package-info.js", () => ({
  getPackageInfo: vi.fn(),
}));

vi.mock("../../routes/files/utils/manage-bucket.js", () => ({
  ensureS3Connectivity: vi.fn(),
}));

const buildHealthcheckApp = async (
  pg: Partial<PostgresDb>,
  s3Client = buildS3ClientMock(),
) => {
  const app = fastify();
  app.decorate("pg", pg as unknown as FastifyInstance["pg"]);
  app.decorate("s3Client", s3Client);
  await app.register(healthcheck);

  return app;
};

const buildPgMock = () => {
  const release = vi.fn();
  const pg = {
    connect: vi.fn().mockResolvedValue({ release }),
    query: vi.fn().mockResolvedValue({ rowCount: 1 }),
  };

  return { pg, release };
};

const buildS3ClientMock = (): S3ClientConfig => ({
  bucketName: "life-events-files",
  client: {
    send: vi.fn(),
  } as unknown as S3ClientConfig["client"],
  config: {
    endpoint: "http://localhost:4566",
    forcePathStyle: true,
    region: "eu-west-1",
  },
});

describe("Healthcheck works as expected", {}, () => {
  let app: FastifyInstance | undefined;

  beforeEach(() => {
    vi.mocked(getPackageInfo).mockResolvedValue({
      name: EXPECTED_PACKAGE_NAME,
      version: EXPECTED_PACKAGE_VERSION,
    });
    vi.mocked(ensureS3Connectivity).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  test("GET /health returns package info without checking external deps", async () => {
    const { pg } = buildPgMock();
    app = await buildHealthcheckApp(pg);

    const res = await app.inject({
      url: "/health",
    });

    assert.deepStrictEqual(200, res.statusCode);
    assert.deepStrictEqual(
      { [EXPECTED_PACKAGE_NAME]: EXPECTED_PACKAGE_VERSION },
      res.json(),
    );
    expect(pg.connect).not.toHaveBeenCalled();
    expect(pg.query).not.toHaveBeenCalled();
  });

  test("GET /health is not affected when external deps reject", async () => {
    const { pg } = buildPgMock();
    pg.connect.mockRejectedValueOnce(new Error("connection refused"));
    app = await buildHealthcheckApp(pg);

    const res = await app.inject({
      url: "/health",
    });

    assert.deepStrictEqual(200, res.statusCode);
    assert.deepStrictEqual(
      { [EXPECTED_PACKAGE_NAME]: EXPECTED_PACKAGE_VERSION },
      res.json(),
    );
    expect(pg.connect).not.toHaveBeenCalled();
    expect(pg.query).not.toHaveBeenCalled();
  });

  test("GET /health is not affected when external deps throw", async () => {
    const { pg } = buildPgMock();
    pg.connect.mockImplementationOnce(() => {
      throw new Error("connection refused");
    });
    app = await buildHealthcheckApp(pg);

    const res = await app.inject({
      url: "/health",
    });

    assert.deepStrictEqual(200, res.statusCode);
    assert.deepStrictEqual(
      { [EXPECTED_PACKAGE_NAME]: EXPECTED_PACKAGE_VERSION },
      res.json(),
    );
    expect(pg.connect).not.toHaveBeenCalled();
    expect(pg.query).not.toHaveBeenCalled();
  });

  test("GET /health/ready returns db readiness when the db check succeeds", async () => {
    const { pg, release } = buildPgMock();
    app = await buildHealthcheckApp(pg);

    const res = await app.inject({
      url: "/health/ready",
    });

    assert.deepStrictEqual(200, res.statusCode);
    assert.deepStrictEqual({ db: true }, res.json());
    expect(pg.connect).toHaveBeenCalledOnce();
    expect(pg.query).toHaveBeenCalledWith('SELECT 1 as "column"');
    expect(release).toHaveBeenCalledOnce();
  });

  test("GET /health/ready returns 500 when the db check has an unexpected row count", async () => {
    const { pg, release } = buildPgMock();
    pg.query.mockResolvedValueOnce({ rowCount: 0 });
    app = await buildHealthcheckApp(pg);

    const res = await app.inject({
      url: "/health/ready",
    });

    assert.deepStrictEqual(500, res.statusCode);
    assert.deepStrictEqual("Expected 1 record, got 0", res.json().message);
    expect(release).toHaveBeenCalledOnce();
  });

  test("GET /health/ready returns 500 when the db query fails", async () => {
    const { pg, release } = buildPgMock();
    pg.query.mockRejectedValueOnce(new Error("db unavailable"));
    app = await buildHealthcheckApp(pg);

    const res = await app.inject({
      url: "/health/ready",
    });

    assert.deepStrictEqual(500, res.statusCode);
    assert.deepStrictEqual("db unavailable", res.json().message);
    expect(release).toHaveBeenCalledOnce();
  });

  test("GET /health/ready preserves http errors from the db check", async () => {
    const { pg, release } = buildPgMock();
    pg.query.mockRejectedValueOnce(
      httpErrors.serviceUnavailable("db temporarily unavailable"),
    );
    app = await buildHealthcheckApp(pg);

    const res = await app.inject({
      url: "/health/ready",
    });

    assert.deepStrictEqual(503, res.statusCode);
    assert.deepStrictEqual("db temporarily unavailable", res.json().message);
    expect(release).toHaveBeenCalledOnce();
  });

  test("GET /health/ready returns 500 when the db connection fails", async () => {
    const { pg } = buildPgMock();
    pg.connect.mockRejectedValueOnce(new Error("connection refused"));
    app = await buildHealthcheckApp(pg);

    const res = await app.inject({
      url: "/health/ready",
    });

    assert.deepStrictEqual(500, res.statusCode);
    assert.deepStrictEqual("connection refused", res.json().message);
    expect(pg.query).not.toHaveBeenCalled();
  });

  test("GET /health/startup returns system, db and s3 status when startup checks succeed", async () => {
    const { pg, release } = buildPgMock();
    const s3Client = buildS3ClientMock();
    app = await buildHealthcheckApp(pg, s3Client);

    const res = await app.inject({
      url: "/health/startup",
    });

    assert.deepStrictEqual(200, res.statusCode);
    assert.deepStrictEqual({ system: true, db: true, s3: true }, res.json());
    expect(getPackageInfo).toHaveBeenCalledOnce();
    expect(pg.connect).toHaveBeenCalledOnce();
    expect(pg.query).toHaveBeenCalledWith('SELECT 1 as "column"');
    expect(release).toHaveBeenCalledOnce();
    expect(ensureS3Connectivity).toHaveBeenCalledWith(
      s3Client,
      expect.any(Object),
    );
  });

  test("GET /health/startup returns 500 with dependency error when s3 is not available", async () => {
    const { pg, release } = buildPgMock();
    vi.mocked(ensureS3Connectivity).mockRejectedValueOnce(
      new Error("s3 unavailable"),
    );
    app = await buildHealthcheckApp(pg);

    const res = await app.inject({
      url: "/health/startup",
    });

    assert.deepStrictEqual(500, res.statusCode);
    assert.deepStrictEqual(
      { system: true, db: true, s3: { error: "s3 unavailable" } },
      res.json(),
    );
    expect(release).toHaveBeenCalledOnce();
  });

  test("GET /health/startup checks db and s3 when the system check fails", async () => {
    const { pg, release } = buildPgMock();
    const s3Client = buildS3ClientMock();
    vi.mocked(getPackageInfo).mockRejectedValueOnce(
      new Error("package unavailable"),
    );
    app = await buildHealthcheckApp(pg, s3Client);

    const res = await app.inject({
      url: "/health/startup",
    });

    assert.deepStrictEqual(500, res.statusCode);
    assert.deepStrictEqual(
      { system: { error: "package unavailable" }, db: true, s3: true },
      res.json(),
    );
    expect(pg.connect).toHaveBeenCalledOnce();
    expect(pg.query).toHaveBeenCalledWith('SELECT 1 as "column"');
    expect(release).toHaveBeenCalledOnce();
    expect(ensureS3Connectivity).toHaveBeenCalledWith(
      s3Client,
      expect.any(Object),
    );
  });

  test("GET /health/startup checks s3 when the db check fails", async () => {
    const { pg, release } = buildPgMock();
    const s3Client = buildS3ClientMock();
    pg.query.mockRejectedValueOnce(new Error("db unavailable"));
    app = await buildHealthcheckApp(pg, s3Client);

    const res = await app.inject({
      url: "/health/startup",
    });

    assert.deepStrictEqual(500, res.statusCode);
    assert.deepStrictEqual(
      { system: true, db: { error: "db unavailable" }, s3: true },
      res.json(),
    );
    expect(release).toHaveBeenCalledOnce();
    expect(ensureS3Connectivity).toHaveBeenCalledWith(
      s3Client,
      expect.any(Object),
    );
  });
});
