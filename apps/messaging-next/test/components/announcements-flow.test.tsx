import { waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AnnouncementsFlow } from "@/components/announcements-flow"
import { renderWithProviders } from "../utils/test-utils"

const mockUseConsent = vi.fn()
const mockAnnouncementsProvider = vi.fn()

vi.mock("@ogcio/consent/react", () => ({
  useConsent: () => mockUseConsent(),
}))

vi.mock("@ogcio/announcements/react", () => ({
  AnnouncementsProvider: ({
    children,
    ...props
  }: {
    children: ReactNode
    applicationId: string
    isAnnouncementsEnabled: boolean
    languageSwitcher: {
      translations: {
        english: string
        irish: string
      }
    }
    locale: string
    onLocaleChange: (locale: string) => void
  }) => {
    mockAnnouncementsProvider(props)

    return (
      <div
        data-application-id={props.applicationId}
        data-enabled={String(props.isAnnouncementsEnabled)}
        data-locale={props.locale}
        data-testid='announcements-provider'
      >
        {children}
      </div>
    )
  },
}))

describe("AnnouncementsFlow", () => {
  const onLocaleChange = vi.fn()
  const languageSwitcher = {
    translations: { english: "English", irish: "Gaeilge" },
  }

  beforeEach(() => {
    mockUseConsent.mockReset()
    mockAnnouncementsProvider.mockReset()
    onLocaleChange.mockReset()
  })

  it("keeps announcements disabled while consent is still loading", () => {
    mockUseConsent.mockReturnValue({
      isConsentModalOpen: false,
      isLoading: true,
      isOptedOut: false,
    })

    const { getByTestId } = renderWithProviders(
      <AnnouncementsFlow
        locale='en'
        onLocaleChange={onLocaleChange}
        languageSwitcher={languageSwitcher}
      >
        <div>content</div>
      </AnnouncementsFlow>,
    )

    expect(getByTestId("announcements-provider")).toHaveAttribute(
      "data-enabled",
      "false",
    )
  })

  it("enables announcements once consent does not need to be shown", async () => {
    mockUseConsent.mockReturnValue({
      isConsentModalOpen: false,
      isLoading: false,
      isOptedOut: false,
    })

    const { getByTestId } = renderWithProviders(
      <AnnouncementsFlow
        locale='en'
        onLocaleChange={onLocaleChange}
        languageSwitcher={languageSwitcher}
      >
        <div>content</div>
      </AnnouncementsFlow>,
    )

    await waitFor(() =>
      expect(getByTestId("announcements-provider")).toHaveAttribute(
        "data-enabled",
        "true",
      ),
    )

    expect(mockAnnouncementsProvider).toHaveBeenLastCalledWith({
      applicationId: "messaging",
      isAnnouncementsEnabled: true,
      languageSwitcher,
      locale: "en",
      onLocaleChange,
    })
  })

  it("waits for the consent modal to close before enabling announcements", async () => {
    mockUseConsent.mockReturnValue({
      isConsentModalOpen: true,
      isLoading: false,
      isOptedOut: false,
    })

    const { getByTestId, rerender } = renderWithProviders(
      <AnnouncementsFlow
        locale='en'
        onLocaleChange={onLocaleChange}
        languageSwitcher={languageSwitcher}
      >
        <div>content</div>
      </AnnouncementsFlow>,
    )

    expect(getByTestId("announcements-provider")).toHaveAttribute(
      "data-enabled",
      "false",
    )

    mockUseConsent.mockReturnValue({
      isConsentModalOpen: false,
      isLoading: false,
      isOptedOut: false,
    })

    rerender(
      <AnnouncementsFlow
        locale='en'
        onLocaleChange={onLocaleChange}
        languageSwitcher={languageSwitcher}
      >
        <div>content</div>
      </AnnouncementsFlow>,
    )

    await waitFor(() =>
      expect(getByTestId("announcements-provider")).toHaveAttribute(
        "data-enabled",
        "true",
      ),
    )
  })

  it("enables announcements when consent is declined", async () => {
    mockUseConsent.mockReturnValue({
      isConsentModalOpen: true,
      isLoading: false,
      isOptedOut: true,
    })

    const { getByTestId } = renderWithProviders(
      <AnnouncementsFlow
        locale='en'
        onLocaleChange={onLocaleChange}
        languageSwitcher={languageSwitcher}
      >
        <div>content</div>
      </AnnouncementsFlow>,
    )

    await waitFor(() =>
      expect(getByTestId("announcements-provider")).toHaveAttribute(
        "data-enabled",
        "true",
      ),
    )
  })
})
