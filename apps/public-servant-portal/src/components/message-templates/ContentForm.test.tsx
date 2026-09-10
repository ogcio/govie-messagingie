import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ContentForm } from "@/components/message-templates/ContentForm"

const { createTemplate, push, toasterCreate, updateTemplate } = vi.hoisted(
  () => ({
    createTemplate: vi.fn(),
    push: vi.fn(),
    toasterCreate: vi.fn(),
    updateTemplate: vi.fn(),
  }),
)

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayMutation: (path: string | null) => ({
    trigger: path?.includes("/templates/") ? updateTemplate : createTemplate,
    isLoading: false,
    error: null,
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}))

vi.mock("@ogcio/design-system-react", async () => ({
  ...(await vi.importActual<typeof import("@ogcio/design-system-react")>(
    "@ogcio/design-system-react",
  )),
  toaster: { create: toasterCreate },
}))

vi.mock("@/hooks/use-organization-id", () => ({
  useOrganizationId: () => "org-1",
}))

vi.mock("next-intl", async () => ({
  ...(await vi.importActual<typeof import("next-intl")>("next-intl")),
  useTranslations: () => (key: string) => `__${key}__`,
}))

describe(ContentForm.name, () => {
  beforeEach(() => vi.clearAllMocks())

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

  it("keeps submission disabled without languages", () => {
    render(
      <NextIntlClientProvider locale='en' messages={{}}>
        <ContentForm />
      </NextIntlClientProvider>,
    )

    expect(screen.getByRole("button", { name: "__create__" })).toBeDisabled()
  })

  it("creates a template from the entered content", async () => {
    createTemplate.mockResolvedValue({ id: "template-1" })
    render(
      <NextIntlClientProvider locale='en' messages={{}}>
        <ContentForm languages={["en"]} />
      </NextIntlClientProvider>,
    )
    fireEvent.change(screen.getByLabelText("__templateNameLabel__"), {
      target: { value: "Notice" },
    })
    fireEvent.change(screen.getByLabelText("__subjectLabel__"), {
      target: { value: "Subject" },
    })
    fireEvent.change(screen.getByLabelText("__richTextLabel__"), {
      target: { value: "<p>Hello</p>" },
    })
    fireEvent.change(screen.getByLabelText("__plainTextLabel__"), {
      target: { value: "Hello" },
    })

    fireEvent.click(screen.getByRole("button", { name: "__create__" }))

    await waitFor(() =>
      expect(createTemplate).toHaveBeenCalledWith({
        contents: [
          {
            language: "en",
            templateName: "Notice",
            subject: "Subject",
            richText: "<p>Hello</p>",
            plainText: "Hello",
          },
        ],
      }),
    )
    expect(push).toHaveBeenCalledWith("./?newid=template-1")
  })

  it("loads and updates existing translated content", async () => {
    updateTemplate.mockResolvedValue(undefined)
    render(
      <NextIntlClientProvider locale='en' messages={{}}>
        <ContentForm
          languages={["ga"]}
          templateId='template-1'
          templates={{
            ga: {
              templateName: "Fógra",
              subject: "Ábhar",
              richText: "<p>Dia duit</p>",
              plainText: "Dia duit",
            },
          }}
        />
      </NextIntlClientProvider>,
    )

    expect(screen.getByLabelText("__templateNameLabel__")).toHaveValue("Fógra")
    fireEvent.click(screen.getByRole("button", { name: "__update__" }))

    await waitFor(() =>
      expect(updateTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "template-1" }),
      ),
    )
    expect(push).toHaveBeenCalledWith("./")
  })

  it("reports template creation failures", async () => {
    createTemplate.mockRejectedValue(new Error("Service unavailable"))
    render(
      <NextIntlClientProvider locale='en' messages={{}}>
        <ContentForm languages={["en"]} />
      </NextIntlClientProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "__create__" }))

    await waitFor(() =>
      expect(toasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Service unavailable" }),
      ),
    )
  })

  it("uses the translated fallback for non-error failures", async () => {
    createTemplate.mockRejectedValue("failed")
    render(
      <NextIntlClientProvider locale='en' messages={{}}>
        <ContentForm languages={["en"]} />
      </NextIntlClientProvider>,
    )
    const subject = screen.getByLabelText("__subjectLabel__")
    subject.removeAttribute("name")
    fireEvent.change(subject, { target: { value: "ignored" } })
    fireEvent.click(screen.getByRole("button", { name: "__create__" }))

    await waitFor(() =>
      expect(toasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "__creationError__" }),
      ),
    )
  })

  it("fills missing translated template content with empty values", () => {
    render(
      <NextIntlClientProvider locale='en' messages={{}}>
        <ContentForm
          languages={["en", "ga"]}
          templates={{
            en: {
              templateName: "Notice",
              subject: "Subject",
              richText: "HTML",
              plainText: "Text",
            },
          }}
        />
      </NextIntlClientProvider>,
    )

    expect(screen.getAllByLabelText("__templateNameLabel__")[0]).toHaveValue(
      "Notice",
    )
    expect(screen.getAllByLabelText("__templateNameLabel__")[1]).toHaveValue("")
  })
})
