import type { FastifyInstance, HTTPMethods } from "fastify";
import { assert, test } from "vitest";

export type ToTestHttpMethods = Extract<
  HTTPMethods,
  "GET" | "OPTIONS" | "DELETE" | "POST" | "PUT" | "PATCH"
>;

export async function ensureHttpMethodsDontExist(
  app: FastifyInstance,
  endpoint: string,
  mustNotExistMethods: ToTestHttpMethods[],
) {
  for (const mustNotExistMethod of mustNotExistMethods) {
    test(`${mustNotExistMethod} throws 404`, async () => {
      const res = await app.inject({
        url: endpoint,
        method: mustNotExistMethod,
      });

      assert.deepStrictEqual(404, res.statusCode);
    });
  }
}
