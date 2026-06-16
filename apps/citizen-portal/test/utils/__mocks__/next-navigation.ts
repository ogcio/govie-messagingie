/**
 * Mock for next/navigation
 * This file is automatically used by Vitest when next/navigation is imported
 */

import { vi } from "vitest"

export const useRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}))

export const usePathname = vi.fn(() => "/en/messages")

export const redirect = vi.fn()
