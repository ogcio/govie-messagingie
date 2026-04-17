import type { FastifyInstance } from "fastify";
import { afterEach, assert, describe, suite, test } from "vitest";
import { build } from "../test-server-builder.js";
import {
  ensureHttpMethodsDontExist,
  type ToTestHttpMethods,
} from "./shared-routes-test.js";

const endpoint = "/health";
const mustNotExistMethods: ToTestHttpMethods[] = [
  "DELETE",
  "POST",
  "OPTIONS",
  "PATCH",
  "PUT",
];

describe("Healthcheck works as expected", () => {
  let app: FastifyInstance | undefined;

  afterEach(() => {
    if (app) {
      app.close();
      app = undefined;
    }
  });

  test("GET /", async () => {
    const app = await build();
    const res = await app.inject({
      url: "/health",
    });

    assert.deepStrictEqual(res.statusCode, 200);
    assert.isObject(res.json());
    assert.deepStrictEqual(res.json(), { "messaging-api": "1.0.0" });
  });

  suite("Unexpected HTTP methods throw 404", async () => {
    const app = await build();

    ensureHttpMethodsDontExist(app, endpoint, mustNotExistMethods);
  });
});
