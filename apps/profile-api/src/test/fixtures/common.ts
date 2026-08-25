import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import { vi } from "vitest";
import type { EnvConfig } from "~/plugins/external/env.js";

// Common mock logger used across tests
export const mockLogger: FastifyBaseLogger = {
  debug: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
  level: "info",
  fatal: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  trace: vi.fn(),
  silent: vi.fn(),
};

// Common mock config used in Logto tests
export const mockLogtoConfig: EnvConfig = {
  HOST_URL: "http://localhost",
  PORT: 3000,
  FASTIFY_CLOSE_GRACE_DELAY: 500,
  LOG_LEVEL: "debug",
  POSTGRES_USER: "test",
  POSTGRES_PASSWORD: "test",
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: 5432,
  POSTGRES_DATABASE: "test",
  LOGTO_JWK_ENDPOINT: "http://logto-jwk",
  LOGTO_OIDC_ENDPOINT: "http://logto-oidc",
  LOGTO_WEBHOOK_SIGNING_KEY: "test-key",
  LOGTO_MANAGEMENT_API_CLIENT_ID: "client-123",
  LOGTO_MANAGEMENT_API_CLIENT_SECRET: "secret-123",
  LOGTO_MANAGEMENT_API_ENDPOINT: "http://logto-api",
  LOGTO_MANAGEMENT_API_RESOURCE_URL: "http://logto-resource",
  ANALYTICS_URL: "http://analytics",
  ANALYTICS_WEBSITE_ID: "website-123",
  ANALYTICS_MATOMO_TOKEN: "token-123",
  ANALYTICS_DRY_RUN: false,
  SCHEDULER_BACKEND_URL: "http://scheduler",
  LOGTO_M2M_SCHEDULER_APP_ID: "scheduler-123",
  LOGTO_M2M_SCHEDULER_APP_SECRET: "scheduler-secret",
  LOGTO_M2M_ANALYTICS_APP_SECRET: "analytics-secret",
  LOGTO_M2M_ANALYTICS_APP_ID: "analytics-123",
  LOGTO_M2M_ANALYTICS_SCOPES: "analytics:read analytics:write",
  LOGTO_M2M_ANALYTICS_ORGANIZATION_ID: "analytics-organization-123",
  PROFILES_IMPORTER_BATCH_SIZE: 100,
  PROFILES_IMPORTER_BATCH_DELAY_SECONDS: 5,
  WORKER_INTERVAL_SECONDS: 60,
  DP_PROXY_API_BASE_URL: "http://dp-proxy",
  AUDIT_COLLECTOR_URL: "http://audit-collector",
} as const;

// Common mock API config
export const mockApiConfig: EnvConfig = {
  HOST_URL: "http://api.example.com",
} as EnvConfig;

// Common mock profiles used in tests
export const mockProfiles = [
  {
    email: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    phone: "1234567890",
    dateOfBirth: "1990-01-01",
    address: "123 Test St",
    city: "Test City",
    externalId: "1234567890",
    ppsn: "1234567T",
  },
  {
    email: "jane@example.com",
    firstName: "Jane",
    lastName: "Smith",
    phone: "0987654321",
    dateOfBirth: "1991-02-02",
    address: "456 Test Ave",
    city: "Test Town",
    externalId: "1234567890",
    ppsn: "1234567T",
  },
];

// Common mock profile imports used in tests
export const mockProfileImports = [
  {
    id: "import-1",
    jobId: "job-1",
    organisationId: "org-1",
    status: "completed",
    metadata: { totalRows: 100, filename: "test-import-1.csv" },
    source: "csv",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "import-2",
    jobId: "job-2",
    organisationId: "org-1",
    status: "processing",
    metadata: { totalRows: 50, filename: "TEST-IMPORT-2.csv" },
    source: "csv",
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
  {
    id: "import-2",
    jobId: "job-2",
    organisationId: "org-1",
    status: "processing",
    metadata: { totalRows: 50 },
    source: "json",
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
] as const;

// Common mock DB profiles
export const mockDbProfiles = [
  {
    id: "profile-123",
    publicName: "Test User 1",
    email: "test1@example.com",
    primaryUserId: "profile-123",
    createdAt: "2024-01-15T12:00:00Z",
    updatedAt: "2024-01-15T12:00:00Z",
    preferredLanguage: "en" as "en" | "ga" | undefined,
    details: {
      firstName: { value: "Test", type: "string" as const },
      lastName: { value: "User", type: "string" as const },
      email: { value: "e@mail.com", type: "string" as const },
      phone: { value: "1234567890", type: "string" as const },
      dateOfBirth: { value: "1990-01-01T00:00:00.000Z", type: "date" as const },
      address: { value: "123 Test St", type: "string" as const },
      city: { value: "Test City", type: "string" as const },
      ppsn: { value: "1234567890", type: "string" as const },
    },
  },
  {
    id: "profile-456",
    publicName: "Test User 2",
    email: "test2@example.com",
    primaryUserId: "user-456",
    createdAt: "2024-01-15T12:00:00Z",
    updatedAt: "2024-01-15T12:00:00Z",
    preferredLanguage: "en" as "en" | "ga" | undefined,
    details: {
      firstName: { value: "Another", type: "string" as const },
      lastName: { value: "User", type: "string" as const },
      email: { value: "e2@mail.com", type: "string" as const },
      phone: { value: "0987654321", type: "string" as const },
      dateOfBirth: { value: "1991-02-02T00:00:00Z", type: "date" as const },
      address: { value: "456 Test Ave", type: "string" as const },
      city: { value: "Test Town", type: "string" as const },
      ppsn: { value: "1234567890", type: "string" as const },
    },
  },
];

// Common mock Logto user responses
export const mockLogtoUsers = [
  { id: "user-1", primaryEmail: "john@example.com" },
  { id: "user-2", primaryEmail: "jane@example.com" },
] as const;

// Common mock data for profile details
export const mockProfileDetails = {
  name: "John Doe",
  age: 30,
  active: true,
  birthDate: "2000-01-01T00:00:00.000Z",
  notes: "some notes",
} as const;

// Helper function to transform DB profile to API profile
export const toApiProfile = (dbProfile: (typeof mockDbProfiles)[0]) => ({
  ...dbProfile,
  details: Object.fromEntries(
    Object.entries(dbProfile.details).map(([key, value]) => [key, value.value]),
  ),
});

// Common mock webhook bodies
export const mockWebhookBodies = {
  userCreated: {
    event: "User.Created",
    data: {
      id: "user-123",
      primaryEmail: "test@example.com",
    },
  },
  userUpdated: {
    event: "User.Data.Updated",
    data: {
      id: "user-123",
      primaryEmail: "test@example.com",
    },
  },
} as const;

// Common mock DB pool for database tests
export const createMockPool = (
  mockQuery: ReturnType<typeof vi.fn> = vi.fn(),
): Pool =>
  ({
    query: mockQuery,
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
    expiredCount: 0,
    end: vi.fn(),
    connect: vi.fn(),
  }) as unknown as Pool;
