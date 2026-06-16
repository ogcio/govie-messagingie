import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it, vi } from "vitest"
import { ContentForm } from "@/components/message-templates/ContentForm"

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayMutation: () => ({
    trigger: vi.fn(),
    isLoading: false,
    error: null,
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock("@/hooks/use-organization-id", () => ({
  useOrganizationId: () => "org-1",
}))

vi.mock("next-intl", async () => ({
  ...(await vi.importActual<typeof import("next-intl")>("next-intl")),
  useTranslations: () => (key: string) => `__${key}__`,
}))

describe(ContentForm.name, () => {
  it("renders english and irish fields when languages prop is set", () => {
    render(
      <NextIntlClientProvider locale='en' messages={{}}>
        <ContentForm languages={["en", "ga"]} />
      </NextIntlClientProvider>,
    )

    expect(
      screen.getAllByLabelText("__templateNameLabel__", { selector: "input" }),
    ).toHaveLength(2)
  })
})
