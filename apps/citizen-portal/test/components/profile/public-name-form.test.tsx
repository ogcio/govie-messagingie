import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const toasterCreate = vi.fn()

vi.mock("@citizen-portal/shared", () => ({
  useEnv: () => ({
    hosts: {
      messages: "http://messaging.local.test:8080",
      profile: "http://profile.local.test:8080",
      dashboard: "http://dashboard.local.test:8080",
    },
    sagUrl: "http://sag.local.test:3333",
    sagAppName: "profile",
  }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `profile.${key}`,
}))

// DS form primitives + the toaster carry side effects (portal mount,
// CSS-only theming) that don't matter for the contract this test
// pins: form submit → fetch hits the right URL → success/failure
// toast fires. Stub them as passthroughs.
vi.mock("@ogcio/design-system-react", () => ({
  FormField: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  FormFieldError: ({ text }: { text: string }) => (
    <div data-testid='public-name-validation-error'>{text}</div>
  ),
  FormFieldLabel: ({ text, htmlFor }: { text: string; htmlFor: string }) => (
    <label htmlFor={htmlFor}>{text}</label>
  ),
  Heading: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TextInput: ({
    value,
    onChange,
    ...rest
  }: {
    value: string
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} onChange={onChange} {...rest} />
  ),
  toaster: {
    create: (...args: unknown[]) => toasterCreate(...args),
  },
}))

vi.mock("@/components/layout/containers", () => ({
  FullWidthContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

import { PublicNameForm } from "@/components/profile/public-name-form"

/**
 * `PublicNameForm` is the only mutation surface on `/en/my-profile`.
 * The submit handler bypasses the gateway client because the patch
 * predates the consolidated SAG wrapper — so the test must pin:
 *   1. the exact URL the bare `fetch()` hits (sagUrl + profileId),
 *   2. the credentials-include flag (cross-zone cookie still flows),
 *   3. the empty-input client-side validation gate,
 *   4. the success vs. failure toast variants.
 *
 * A regression on (1) or (2) silently breaks the form on every
 * environment; a regression on (3) lets the API see an empty
 * publicName which it accepts and the user loses their handle.
 */
describe("PublicNameForm", () => {
  const fetchMock = vi.fn()
  const onUpdated = vi.fn()
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock.mockReset()
    onUpdated.mockReset()
    toasterCreate.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("PATCHes the SAG endpoint with credentials and the trimmed publicName, then fires the success toast", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })

    render(
      <PublicNameForm
        publicName='  Jane Doe  '
        profileId='profile-1'
        onUpdated={onUpdated}
      />,
    )

    fireEvent.submit(screen.getByTestId("public-name-form"))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      "http://sag.local.test:3333/profile/api/v1/profiles/profile-1",
    )
    expect(init.method).toBe("PATCH")
    expect(init.credentials).toBe("include")
    expect(JSON.parse(init.body as string)).toEqual({
      publicName: "Jane Doe",
    })

    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1))
    expect(toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    )
  })

  it("blocks submission and surfaces a validation error when the input is empty", async () => {
    render(
      <PublicNameForm
        publicName=''
        profileId='profile-1'
        onUpdated={onUpdated}
      />,
    )

    fireEvent.submit(screen.getByTestId("public-name-form"))

    await waitFor(() =>
      expect(
        screen.getByTestId("public-name-validation-error"),
      ).toBeInTheDocument(),
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onUpdated).not.toHaveBeenCalled()
  })

  it("fires the danger toast and skips onUpdated when the API responds non-OK", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false })

    render(
      <PublicNameForm
        publicName='Jane'
        profileId='profile-1'
        onUpdated={onUpdated}
      />,
    )

    fireEvent.submit(screen.getByTestId("public-name-form"))

    await waitFor(() => expect(toasterCreate).toHaveBeenCalledTimes(1))
    expect(toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "danger" }),
    )
    expect(onUpdated).not.toHaveBeenCalled()
  })

  it("fires the danger toast when fetch rejects (network error)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"))

    render(
      <PublicNameForm
        publicName='Jane'
        profileId='profile-1'
        onUpdated={onUpdated}
      />,
    )

    fireEvent.submit(screen.getByTestId("public-name-form"))

    await waitFor(() => expect(toasterCreate).toHaveBeenCalledTimes(1))
    expect(toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "danger" }),
    )
  })
})
