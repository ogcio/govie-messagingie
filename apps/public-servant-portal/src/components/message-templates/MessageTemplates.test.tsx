import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MessageTemplateForm } from "./MessageTemplateForm"
import { MessageTemplateFormClient } from "./message-template-form-client"
import { MessageTemplatesPageClient } from "./message-templates-page-client"

const { fetchMock, searchParamsMock } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3022"
  process.env.NEXT_PUBLIC_SAG_URL ??= "http://localhost:3030"

  return {
    fetchMock: vi.fn(),
    searchParamsMock: new URLSearchParams(),
  }
})

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: (path: string | null) => fetchMock(path),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock,
}))

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))

vi.mock("@ogcio/design-system-react", () => ({
  Breadcrumbs: ({ children }: { children: ReactNode }) => <nav>{children}</nav>,
  BreadcrumbLink: ({ children }: { children: ReactNode }) => (
    <a href='/'>{children}</a>
  ),
  BreadcrumbCurrentLink: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
  Checkbox: ({
    id,
    label,
    checked,
    onChange,
  }: {
    id: string
    label: string
    checked: boolean
    onChange: () => void
  }) => (
    <label>
      <input id={id} type='checkbox' checked={checked} onChange={onChange} />
      {label}
    </label>
  ),
  Heading: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/BackButton", () => ({
  BackLink: ({ children }: { children: ReactNode }) => (
    <a href='/'>{children}</a>
  ),
}))

vi.mock("./ContentForm", () => ({
  ContentForm: ({ languages }: { languages: string[] }) => (
    <div data-testid='content-form'>{languages.join(",")}</div>
  ),
}))

vi.mock("@/components/message-templates/TemplatesList", () => ({
  default: () => <div data-testid='templates-list' />,
}))

beforeEach(() => {
  fetchMock.mockReset()
  for (const key of [...searchParamsMock.keys()]) {
    searchParamsMock.delete(key)
  }
  fetchMock.mockReturnValue({ data: undefined })
})

describe(MessageTemplatesPageClient.name, () => {
  it("renders its heading and templates list", () => {
    render(<MessageTemplatesPageClient />)

    expect(screen.getByRole("heading", { name: "main" })).toBeInTheDocument()
    expect(screen.getByTestId("templates-list")).toBeInTheDocument()
  })
})

describe(MessageTemplateFormClient.name, () => {
  it("fetches and maps template contents into form data", () => {
    searchParamsMock.set("id", "template-1")
    fetchMock.mockReturnValue({
      data: {
        contents: [
          {
            language: "ga",
            subject: "Ábhar",
            plainText: "Téacs",
            templateName: "Teimpléad",
          },
        ],
      },
    })

    render(<MessageTemplateFormClient />)

    expect(fetchMock).toHaveBeenCalledWith(
      "/messaging/api/v1/templates/template-1",
    )
    expect(screen.getByTestId("content-form")).toHaveTextContent("ga")
    expect(
      screen.getByRole("heading", { name: "updateTemplateHeader" }),
    ).toBeInTheDocument()
  })

  it("does not fetch when creating a template", () => {
    render(<MessageTemplateFormClient />)

    expect(fetchMock).toHaveBeenCalledWith(null)
    expect(
      screen.getByRole("heading", { name: "createNewTemplateHeader" }),
    ).toBeInTheDocument()
  })
})

describe(MessageTemplateForm.name, () => {
  it("shows content fields only for selected languages", async () => {
    const user = userEvent.setup()
    render(<MessageTemplateForm />)

    expect(screen.queryByTestId("content-form")).not.toBeInTheDocument()
    await user.click(screen.getByLabelText("en"))

    expect(screen.getByTestId("content-form")).toHaveTextContent("en")
  })
})
