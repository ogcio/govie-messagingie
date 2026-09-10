import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// The real package can't load under vitest (extensionless ESM imports) and
// bundles its own react@18, which clashes with the app's react@19.
vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
  AnalyticsProvider: ({ children }: { children: React.ReactNode }) => children,
}))

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserver
