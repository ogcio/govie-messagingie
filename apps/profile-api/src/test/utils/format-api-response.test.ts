import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { mockApiConfig } from "~/test/fixtures/common.js";
import type { PaginationDetails } from "~/types/pagination.js";
import { formatAPIResponse } from "~/utils/pagination.js";

describe("formatAPIResponse", () => {
  const mockData = [
    { id: 1, name: "Test 1" },
    { id: 2, name: "Test 2" },
  ];

  describe("Basic Response", () => {
    it("should return data without metadata when no pagination or request is provided", () => {
      const response = formatAPIResponse({
        data: mockData,
        config: mockApiConfig,
        totalCount: 2,
      });

      expect(response).toEqual({
        data: mockData,
      });
    });
  });

  describe("With Pagination Details", () => {
    it("should include metadata with pagination links when pagination details are provided", () => {
      const pagination = {
        url: new URL("http://api.example.com/items"),
        limit: 10,
        offset: 0,
      };

      const response = formatAPIResponse({
        data: mockData,
        config: mockApiConfig,
        pagination,
        totalCount: 15,
      });

      expect(response).toMatchObject({
        data: mockData,
        metadata: {
          totalCount: 15,
          links: {
            self: { href: expect.stringContaining("limit=10&offset=0") },
            next: { href: expect.stringContaining("limit=10&offset=10") },
            first: { href: expect.stringContaining("limit=10&offset=0") },
            last: { href: expect.stringContaining("limit=10&offset=10") },
          },
        },
      });
    });

    it("should handle pagination with no next page", () => {
      const pagination = {
        url: new URL("http://api.example.com/items"),
        limit: 10,
        offset: 10,
      };

      const response = formatAPIResponse({
        data: mockData,
        config: mockApiConfig,
        pagination,
        totalCount: 15,
      });

      expect(response.metadata?.links?.next?.href).toBeUndefined();
      expect(response.metadata?.links?.prev?.href).toBeDefined();
    });
  });

  describe("With Request", () => {
    it("should extract pagination details from request query parameters", () => {
      const mockRequest = {
        originalUrl: "/items?limit=5&offset=10",
      } as unknown as FastifyRequest;

      const response = formatAPIResponse({
        data: mockData,
        config: mockApiConfig,
        request: mockRequest,
        totalCount: 15,
      });

      expect(response).toMatchObject({
        data: mockData,
        metadata: {
          totalCount: 15,
          links: {
            self: { href: expect.stringContaining("limit=5&offset=10") },
            prev: { href: expect.stringContaining("limit=5&offset=5") },
            first: { href: expect.stringContaining("limit=5&offset=0") },
            last: { href: expect.stringContaining("offset=10") },
          },
        },
      });
    });

    it("should handle request without pagination parameters", () => {
      const mockRequest = {
        originalUrl: "/items",
      } as unknown as FastifyRequest;

      const response = formatAPIResponse({
        data: mockData,
        config: mockApiConfig,
        request: mockRequest,
        totalCount: 2,
      });

      expect(response).toMatchObject({
        data: mockData,
        metadata: {
          totalCount: 2,
          links: expect.any(Object),
        },
      });
    });

    it("should preserve other query parameters in pagination links", () => {
      const mockRequest = {
        originalUrl: "/items?limit=5&offset=0&filter=active",
      } as unknown as FastifyRequest;

      const response = formatAPIResponse({
        data: mockData,
        config: mockApiConfig,
        request: mockRequest,
        totalCount: 15,
      });

      expect(response.metadata?.links?.self?.href).toContain("filter=active");
      expect(response.metadata?.links?.next?.href).toContain("filter=active");
      expect(response.metadata?.links?.first?.href).toContain("filter=active");
      expect(response.metadata?.links?.last?.href).toContain("filter=active");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty data array", () => {
      const response = formatAPIResponse({
        data: [],
        config: mockApiConfig,
        totalCount: 0,
      });

      expect(response).toEqual({
        data: [],
      });
    });

    it("should handle pagination with single page", () => {
      const pagination: PaginationDetails = {
        url: new URL("http://api.example.com/items"),
        limit: 10,
        offset: 0,
      };

      const response = formatAPIResponse({
        data: mockData,
        config: mockApiConfig,
        pagination,
        totalCount: 2,
      });

      expect(response.metadata?.links?.next?.href).toBeUndefined();
      expect(response.metadata?.links?.prev?.href).toBeUndefined();
      expect(response.metadata?.links?.first?.href).toBe(
        response.metadata?.links?.last?.href,
      );
    });

    it("should handle pagination with exactly full pages", () => {
      const pagination: PaginationDetails = {
        url: new URL("http://api.example.com/items"),
        limit: 2,
        offset: 0,
      };

      const response = formatAPIResponse({
        data: mockData,
        config: mockApiConfig,
        pagination,
        totalCount: 4,
      });

      expect(response.metadata?.links?.next?.href).toBeDefined();
      expect(response.metadata?.links?.last?.href).toContain("offset=2");
    });
  });

  describe("Priority Handling", () => {
    it("should prioritize pagination details over request when both are provided", () => {
      const pagination: PaginationDetails = {
        url: new URL("http://api.example.com/items"),
        limit: 10,
        offset: 0,
      };

      const mockRequest = {
        originalUrl: "/items?limit=5&offset=5",
      } as unknown as FastifyRequest;

      const response = formatAPIResponse({
        data: mockData,
        config: mockApiConfig,
        pagination,
        request: mockRequest,
        totalCount: 15,
      });

      expect(response.metadata?.links?.self?.href).toContain(
        "limit=10&offset=0",
      );
    });
  });
});
