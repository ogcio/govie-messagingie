import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ServiceUserImport } from "@/components/profile-admin/service-users/service-user-import"

const { replaceMock, searchParamsMock, useGatewayFetchMock } = vi.hoisted(
  () => {
    process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3022"
    process.env.NEXT_PUBLIC_SAG_URL ??= "http://localhost:3030"

    return {
      replaceMock: vi.fn(),
      searchParamsMock: new URLSearchParams(),
      useGatewayFetchMock: vi.fn(),
    }
  },
)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => searchParamsMock,
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: (path: string | null) => useGatewayFetchMock(path),
}))

vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}))

vi.mock("@ogcio/design-system-react", () => ({
  Heading: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  Spinner: () => <span data-testid='spinner' />,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/profile-admin/navigation/back-link", () => ({
  BackLink: ({ children }: { children: React.ReactNode }) => (
    <a href='/back'>{children}</a>
  ),
}))

vi.mock("@/components/profile-admin/server-error", () => ({
  ServerError: () => <div data-testid='server-error' />,
}))

vi.mock(
  "@/components/profile-admin/service-users/service-users-import-details-table",
  () => ({
    ServiceUsersImportDetailsTable: () => <div data-testid='import-details' />,
  }),
)

vi.mock("@/components/profile-admin/service-users/status-tag", () => ({
  StatusTag: () => <span>status</span>,
}))

describe(ServiceUserImport.name, () => {
  beforeEach(() => {
    replaceMock.mockReset()
    for (const key of [...searchParamsMock.keys()]) {
      searchParamsMock.delete(key)
    }
    useGatewayFetchMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
    })
  })

  it("redirects to the service-users list when id is missing", async () => {
    render(<ServiceUserImport />)

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/en/service-users"),
    )
    expect(useGatewayFetchMock).toHaveBeenCalledWith(null)
  })

  it("does not render the detail shell when id is missing", () => {
    const { container } = render(<ServiceUserImport />)

    expect(container).toBeEmptyDOMElement()
    expect(replaceMock).toHaveBeenCalledWith("/en/service-users")
  })

  it("fetches the import when id is present", () => {
    searchParamsMock.set("id", "import-1")
    useGatewayFetchMock.mockReturnValue({
      data: {
        createdAt: "2024-01-02T12:00:00.000Z",
        status: "completed",
        metadata: { filename: "users.csv" },
        details: [],
      },
      error: undefined,
      isLoading: false,
    })

    render(<ServiceUserImport />)

    expect(replaceMock).not.toHaveBeenCalled()
    expect(useGatewayFetchMock).toHaveBeenCalledWith(
      "/profile/api/v1/profiles/imports/import-1",
    )
  })
})
