import type { PostgresDb } from "@fastify/postgres";
import { httpErrors } from "@fastify/sensible";
import fastify, { type FastifyInstance } from "fastify";
import { afterEach, assert, describe, expect, test, vi } from "vitest";
import healthcheck from "../../routes/healthcheck.js";

const EXPECTED_PACKAGE_NAME = "messaging-api";
const EXPECTED_PACKAGE_VERSION = "1.0.0";

vi.mock("../../utils/get-package-info.js", () => ({
  getPackageInfo: () =>
    Promise.resolve({
      name: EXPECTED_PACKAGE_NAME,
      version: EXPECTED_PACKAGE_VERSION,
    }),
}));

const buildHealthcheckApp = async (pg: Partial<PostgresDb>) => {
  const app = fastify();
  app.decorate("pg", pg as unknown as FastifyInstance["pg"]);
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

describe("Healthcheck works as expected", {}, () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
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
});
