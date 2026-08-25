import { type Mock, vi } from "vitest";

export const mockCreateLogtoUsers: Mock = vi.fn().mockResolvedValue([
  { id: "user-1", primaryEmail: "test1@example.com" },
  { id: "user-2", primaryEmail: "test2@example.com" },
]);
