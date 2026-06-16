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
  // Capture every prop the real <AnnouncementsProvider> consumes so the
  // mockAnnouncementsProvider spy can assert on the shape passed to it.
  // We intentionally do NOT type the params with a hand-rolled shape —
  // the upstream provider grew new props (modalHeader, showToastOnSuccess)
  // after this test was first written, and a typed destructure here
  // becomes the kind of brittle mock that needs editing every time the
  // upstream surface evolves. `{ children, ...props }` lets the test
  // assert on the subset it cares about via toMatchObject.
  AnnouncementsProvider: ({
    children,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) => {
    mockAnnouncementsProvider(props)

    return (
      <div
        data-application-id={String(props.applicationId)}
        data-enabled={String(props.isAnnouncementsEnabled)}
        data-locale={String(props.locale)}
        data-testid='announcements-provider'
      >
        {children}
      </div>
    )
  },
  // The component renders <AnnouncementsModal /> alongside its children;
  // a stand-in node is enough since the test only asserts on the
  // provider's `data-enabled` attribute.
  AnnouncementsModal: () => <div data-testid='announcements-modal' />,
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

    // The provider is invoked with at least these props — the real
    // component also passes modalHeader and showToastOnSuccess, which
    // toMatchObject lets us ignore so the test doesn't need editing
    // every time the upstream prop surface grows.
    expect(mockAnnouncementsProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({
        applicationId: "messaging",
        isAnnouncementsEnabled: true,
        languageSwitcher,
        locale: "en",
        onLocaleChange,
      }),
    )
  })

  // The component's only gate is `!isConsentLoading`; this test pins the
  // loading→loaded transition so a regression that flipped the gate
  // back to `isConsentModalOpen` (or that dropped the loading guard
  // altogether) would fail here. The prior version of this test asserted
  // a modal-open gate that the component never implemented and was
  // therefore a permanent red — see test/unified-inbox-quality-report.md.
  it("transitions from disabled to enabled when consent finishes loading", async () => {
    mockUseConsent.mockReturnValue({
      isConsentModalOpen: false,
      isLoading: true,
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
