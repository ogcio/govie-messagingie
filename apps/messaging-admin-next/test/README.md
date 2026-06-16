# Testing Guide for messaging-next

This guide explains how to test Next.js pages (server-side) and components in the messaging-next app.

## Setup

The project uses:
- **Vitest** - Test runner
- **@testing-library/react** - Component testing utilities
- **@testing-library/jest-dom** - DOM matchers
- **@vitest/browser-playwright** - Browser testing for E2E scenarios

## Testing Strategies

### 1. Component Testing (Client Components)

Client components can be tested directly with React Testing Library.

**Example:**
```tsx
import { render, screen } from "@testing-library/react"
import { MessageView } from "@/components/message-views"

test("renders message subject", () => {
  render(<MessageView message={mockMessage} />)
  expect(screen.getByText("Test message")).toBeInTheDocument()
})
```

**Best Practices:**
- Test user-visible behavior, not implementation details
- Use `screen.getByRole`, `screen.getByText`, etc. for queries
- Mock external dependencies (API calls, Next.js features)

### 2. Server Component Testing

**Limitation:** Vitest does not fully support async Server Components. Use these approaches:

#### Option A: Test Data Fetching Logic Separately

Test the data fetching functions that Server Components use:

```tsx
import { getMessages } from "@/services/messages"

test("getMessages returns data", async () => {
  const result = await getMessages()
  expect(result.data).toBeDefined()
})
```

#### Option B: Browser Testing (Recommended for Pages)

Use Vitest's browser mode to test full pages:

```tsx
import { expect, test } from "vitest"

test("messages page renders", async ({ page }: { page: any }) => {
  await page.goto("http://localhost:3000/en/messages")
  await expect(page.getByRole("heading")).toBeVisible()
})
```

**To run browser tests:**
1. Start the dev server: `pnpm dev` (in one terminal)
2. Run browser tests: `pnpm test:browser` (in another terminal)
3. Or run a specific file: `pnpm vitest --browser test/pages/messages-page.browser.test.ts`

#### Option C: E2E Tests with Playwright

For full page testing, use Playwright E2E tests (separate from unit tests).

### 3. Testing Pages with Next.js Features

When testing components that use Next.js features:

#### Mocking next-intl and Next.js Navigation

For components using `next-intl/navigation`, mock both `next/navigation` and `next-intl/navigation`:

```tsx
import { vi } from "vitest"

// Mock next/navigation first (required by next-intl)
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/en/messages",
  redirect: vi.fn(),
}))

// Mock next-intl/navigation
vi.mock("next-intl/navigation", () => ({
  createNavigation: () => ({
    Link: ({ children, href, ...props }: any) => (
      <a href={href} {...props}>{children}</a>
    ),
    redirect: vi.fn(),
    usePathname: () => "/en/messages",
    useRouter: () => ({ /* ... */ }),
    getPathname: () => "/en/messages",
  }),
}))
```

See `test/components/message-views.test.tsx` for a complete example.

## Test Utilities

### `test-utils.tsx`

- `renderWithProviders()` - Custom render function (extend as needed)
- `mockMessage`, `mockMessages` - Test data

### `next-mocks.ts`

- `mockUseTranslations` - Mock for useTranslations hook
- `mockSetRequestLocale` - Mock for setRequestLocale
- `createMockParams()` - Create mock Next.js params
- `createMockSearchParams()` - Create mock search params

**Note:** For components using `next-intl/navigation`, you need to mock both `next/navigation` and `next-intl/navigation` directly in your test file (see example above).

## Running Tests

```bash
# Run all tests (unit tests only)
pnpm test

# Run tests in watch mode
pnpm test:local

# Run browser tests (requires dev server running)
pnpm test:browser

# Run a specific browser test file
pnpm vitest --browser test/pages/messages-page.browser.test.ts
```

## File Structure

```
test/
├── components/          # Component tests
├── pages/               # Page/route tests
├── utils/               # Test utilities and mocks
├── vitest.setup.ts      # Global test setup
└── README.md           # This file
```

## Examples

See the example tests:
- `test/components/message-views.test.tsx` - Client component testing with next-intl mocks
- `test/components/messages.test.tsx` - Placeholder (components using React's `use()` hook are better tested with E2E)
- `test/pages/messages-page.test.tsx` - Server component data fetching logic
- `test/pages/messages-page.browser.test.ts` - Browser-based page testing (requires dev server)

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what users see and do
   - Avoid testing internal state or methods

2. **Mock External Dependencies**
   - API calls
   - Next.js routing
   - Third-party libraries

3. **Use Descriptive Test Names**
   - "should render message subject" not "renders correctly"

4. **Keep Tests Isolated**
   - Each test should be independent
   - Use `beforeEach` to reset state

5. **Test Error Cases**
   - Network failures
   - Invalid data
   - Edge cases

## Limitations

- **Async Server Components**: Vitest cannot directly test async Server Components. Test the data fetching logic separately or use browser/E2E tests.
- **Next.js Cache**: Server Components using `"use cache"` may need special handling in tests.
- **Server-only APIs**: Some Next.js APIs (like `headers()`, `cookies()`) require server context and should be tested with E2E tests.

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Next.js Testing Guide](https://nextjs.org/docs/app/building-your-application/testing)
