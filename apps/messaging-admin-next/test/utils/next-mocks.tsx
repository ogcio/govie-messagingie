/**
 * Mock utilities for Next.js and next-intl
 * Use these in your test files to mock Next.js-specific functionality
 */

import { vi } from "vitest"

/**
 * Mock next-intl's useTranslations hook
 */
export const mockUseTranslations = vi.fn((key: string) => {
  return (translationKey: string) => {
    // Return a simple translation key for testing
    // In real tests, you might want to provide actual translations
    return `${key}.${translationKey}`
  }
})

/**
 * Mock next-intl's setRequestLocale
 */
export const mockSetRequestLocale = vi.fn()

/**
 * Mock next-intl's createNavigation
 * This mocks the Link, redirect, usePathname, useRouter, and getPathname exports
 */
export const mockLink = vi.fn(({ children, href, ...props }: any) => {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  )
})

export const mockRedirect = vi.fn()
export const mockUsePathname = vi.fn(() => "/en/messages")
export const mockUseRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}))

export const mockGetPathname = vi.fn(() => "/en/messages")

/**
 * Setup mocks for next-intl
 *
 * IMPORTANT: vi.mock() must be called at the top level of test files.
 * Import this file in your test files to automatically set up mocks.
 *
 * Usage:
 * import "../utils/next-mocks" // This will set up all mocks
 *
 * Note: Mocks must be defined before any imports that use them.
 * The order matters: next/navigation must be mocked before next-intl/navigation
 */

// Mock next/navigation FIRST (required by next-intl)
vi.mock("next/navigation", () => ({
  useRouter: () => mockUseRouter(),
  usePathname: () => mockUsePathname(),
  redirect: mockRedirect,
}))

// Mock next-intl at module level
vi.mock("next-intl", () => ({
  useTranslations: mockUseTranslations,
  setRequestLocale: mockSetRequestLocale,
}))

// Mock next-intl/navigation at module level (depends on next/navigation)
vi.mock("next-intl/navigation", () => ({
  createNavigation: vi.fn(() => ({
    Link: mockLink,
    redirect: mockRedirect,
    usePathname: mockUsePathname,
    useRouter: mockUseRouter,
    getPathname: mockGetPathname,
  })),
}))

/**
 * Mock Next.js params
 * Usage: const params = createMockParams({ locale: "en", id: "1" })
 */
export function createMockParams<T extends Record<string, string>>(
  params: T,
): Promise<T> {
  return Promise.resolve(params)
}

/**
 * Mock Next.js searchParams
 */
export function createMockSearchParams(
  searchParams: Record<string, string | string[] | undefined> = {},
): Promise<Record<string, string | string[] | undefined>> {
  return Promise.resolve(searchParams)
}
