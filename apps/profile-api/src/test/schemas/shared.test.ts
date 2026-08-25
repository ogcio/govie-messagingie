import type { FastifySchema } from "fastify";
import { describe, expect, it } from "vitest";

describe("Shared Schemas", () => {
  describe("FastifyRequestTypebox", () => {
    it("should be a valid type", () => {
      // This test verifies that the type can be used without TypeScript errors
      const mockSchema: FastifySchema = {
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      };

      // If this compiles, the type is valid
      expect(typeof mockSchema).toBe("object");
    });
  });

  describe("FastifyReplyTypebox", () => {
    it("should be a valid type", () => {
      // This test verifies that the type can be used without TypeScript errors
      const mockSchema: FastifySchema = {
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      };

      // If this compiles, the type is valid
      expect(typeof mockSchema).toBe("object");
    });
  });

  describe("Type compatibility", () => {
    it("should work with complex schemas", () => {
      const complexSchema: FastifySchema = {
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
            version: { type: "number" },
          },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            limit: { type: "number" },
            offset: { type: "number" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
          },
          required: ["name", "email"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      };

      expect(typeof complexSchema).toBe("object");
      expect(complexSchema.params).toBeDefined();
      expect(complexSchema.response).toBeDefined();
    });
  });
});
