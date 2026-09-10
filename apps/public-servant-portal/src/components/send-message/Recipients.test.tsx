import { flexRender } from "@tanstack/react-table"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import Recipients from "./Recipients"
import { SendMessageContext, SendMessageSteps } from "./SendMessageContext"

const {
  clientFetch,
  createProfile,
  fetchMock,
  onStep,
  pushMock,
  refresh,
  searchParams,
  toasterCreate,
} = vi.hoisted(() => ({
  clientFetch: vi.fn(),
  createProfile: vi.fn(),
  fetchMock: vi.fn(),
  onStep: vi.fn(),
  pushMock: vi.fn(),
  refresh: vi.fn(),
  searchParams: new URLSearchParams(),
  toasterCreate: vi.fn(),
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayFetch: (path: string) => fetchMock(path),
  useGatewayMutation: () => ({ trigger: createProfile }),
  useSagClient: () => ({ fetch: clientFetch }),
}))
vi.mock("@ogcio/sag-client", () => ({}))
vi.mock("@/components/UserContext", () => ({
  useUser: () => ({ id: "user-1" }),
  useUserRoles: () => ({ canCreateProfiles: false, canUploadFiles: false }),
}))
vi.mock("@ogcio/nextjs-analytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParams,
}))
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock("@/hooks/use-organization-id", () => ({
  useOrganizationId: () => "org-1",
}))
vi.mock("@/components/BackButton", () => ({
  BackButton: ({ children, onClick }: React.ComponentProps<"button">) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
}))
vi.mock("@/components/containers", () => ({
  FullWidthContainer: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}))
vi.mock("@/components/icons/add-circle", () => ({ AddCircleIcon: () => null }))
vi.mock("@/components/icons/delete", () => ({ DeleteIcon: () => null }))
vi.mock("@/components/tables/TanStackTable", () => ({
  TanStackTable: ({
    table,
    "aria-label": ariaLabel,
  }: {
    table: {
      getRowModel: () => {
        rows: Array<{
          id: string
          getVisibleCells: () => Array<{
            id: string
            column: { columnDef: { cell?: unknown } }
            getContext: () => unknown
            getValue: () => unknown
          }>
        }>
      }
    }
    "aria-label": string
  }) => (
    <table aria-label={ariaLabel}>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {cell.column.columnDef.cell
                  ? flexRender(
                      cell.column.columnDef.cell as Parameters<
                        typeof flexRender
                      >[0],
                      cell.getContext() as Parameters<typeof flexRender>[1],
                    )
                  : String(cell.getValue())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))
vi.mock("@ogcio/design-system-react", () => ({
  Button: ({
    ariaLabel,
    children,
    disabled,
    onClick,
    type = "button",
  }: React.ComponentProps<"button"> & { ariaLabel?: string }) => (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
  FormField: ({
    children,
    label,
  }: React.PropsWithChildren<{ label: { text: string; htmlFor: string } }>) => (
    <div>
      <label htmlFor={label.htmlFor}>{label.text}</label>
      {children}
    </div>
  ),
  Heading: ({ children }: React.PropsWithChildren) => <h1>{children}</h1>,
  InputText: (props: React.ComponentProps<"input">) => <input {...props} />,
  Pagination: ({
    currentPage,
    onPageChange,
  }: {
    currentPage: number
    onPageChange: (page: number) => void
  }) => (
    <button type='button' onClick={() => onPageChange(currentPage + 1)}>
      page {currentPage}
    </button>
  ),
  Paragraph: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  Spinner: () => <span role='status' />,
  Stack: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabItem: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  TabList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TabPanel: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Tabs: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  toaster: { create: toasterCreate },
}))

const recipient = {
  id: "profile-1",
  email: "ada@example.com",
  publicName: "Ada Lovelace",
  status: "active",
  consentStatuses: { messaging: { status: "opted-in" } },
}

function getInput(selector: string) {
  const input = document.querySelector<HTMLInputElement>(selector)
  if (!input) throw new Error(`Missing input: ${selector}`)
  return input
}

function renderRecipients(canCreateProfiles = false) {
  render(
    <SendMessageContext.Provider
      value={{
        userId: "user-1",
        canCreateProfiles,
        canUploadFiles: false,
        searchParams: {},
        message: { templateMetaId: "template-1" },
        pendingFiles: [],
        step: SendMessageSteps.recipients,
        errors: {},
        setMessage: vi.fn(),
        setPendingFiles: vi.fn(),
        setSearchParams: vi.fn(),
        onStep,
        setErrors: vi.fn(),
        setStep: vi.fn(),
      }}
    >
      <Recipients />
    </SendMessageContext.Provider>,
  )
}

describe(Recipients.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of [...searchParams.keys()]) searchParams.delete(key)
    fetchMock.mockReturnValue({
      data: [recipient],
      metadata: { totalCount: 1 },
      refresh,
    })
  })

  it("searches using the entered recipient details", async () => {
    renderRecipients()

    await userEvent.type(
      screen.getByLabelText("label.email"),
      "ada@example.com",
    )
    await userEvent.click(screen.getByRole("button", { name: "button.search" }))

    expect(pushMock).toHaveBeenCalledWith(
      "?firstName=&surname=&email=ada%40example.com",
    )
  })

  it("selects an eligible recipient and advances with their id", async () => {
    renderRecipients()

    await userEvent.click(
      screen.getByRole("button", { name: "button.arialabel.addRecipient" }),
    )
    expect(
      screen.getByRole("button", { name: "button.continue" }),
    ).toBeEnabled()
    await userEvent.click(
      screen.getByRole("button", { name: "button.continue" }),
    )

    expect(onStep).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["profile-1"] }),
      "next",
    )
  })

  it("removes a selected recipient and returns to the previous step", async () => {
    renderRecipients()
    await userEvent.click(
      screen.getByRole("button", { name: "button.arialabel.addRecipient" }),
    )

    await userEvent.click(
      screen.getByRole("button", { name: "button.arialabel.removeRecipient" }),
    )
    expect(
      screen.getByRole("button", { name: "button.continue" }),
    ).toBeDisabled()

    await userEvent.click(screen.getByRole("button", { name: "button.back" }))
    expect(onStep).toHaveBeenCalledWith(
      expect.objectContaining({ templateMetaId: "template-1" }),
      "previous",
    )
  })

  it("resets search filters and changes page", async () => {
    searchParams.set("firstName", "Ada")
    searchParams.set("offset", "5")
    searchParams.set("limit", "5")
    fetchMock.mockReturnValue({
      data: [recipient],
      metadata: { links: { pages: { "1": "one", "3": "three" } } },
      refresh,
    })
    renderRecipients()

    await userEvent.click(screen.getByRole("button", { name: "button.reset" }))
    expect(screen.getByLabelText("label.firstName")).toHaveValue("")
    expect(pushMock).toHaveBeenCalledWith("?limit=5")

    await userEvent.click(screen.getByRole("button", { name: "page 2" }))
    expect(pushMock).toHaveBeenLastCalledWith(
      "?firstName=Ada&offset=10&limit=5",
    )
  })

  it("disables recipients who cannot receive messages", () => {
    fetchMock.mockReturnValue({
      data: [
        { ...recipient, status: "inactive" },
        {
          ...recipient,
          id: "profile-2",
          consentStatuses: { messaging: { status: "opted-out" } },
        },
      ],
      metadata: {},
      refresh,
    })
    renderRecipients()

    expect(screen.getAllByText("table.consentDisabled")).toHaveLength(1)
    for (const button of screen.getAllByRole("button", {
      name: "button.arialabel.addRecipient",
    })) {
      expect(button).toBeDisabled()
    }
  })

  it("reports recipient fetch failures", () => {
    fetchMock.mockReturnValue({
      data: [],
      metadata: undefined,
      error: new Error("failed"),
      refresh,
    })
    renderRecipients()

    expect(toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "toast.error.databaseFetch" }),
    )
  })

  it("rejects adding an existing ineligible recipient", async () => {
    clientFetch.mockResolvedValue({
      data: [{ ...recipient, status: "inactive" }],
    })
    renderRecipients(true)

    await userEvent.type(getInput("#emailNew"), "ada@example.com")
    await userEvent.click(
      screen.getByRole("button", { name: "button.importUser" }),
    )

    await waitFor(() =>
      expect(toasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "toast.error.emailExists" }),
      ),
    )
    expect(toasterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "toast.error.consentDisabled" }),
    )
    expect(createProfile).not.toHaveBeenCalled()
  })

  it("creates and selects a new recipient after polling", async () => {
    clientFetch.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
      data: [{ ...recipient, id: "new-profile" }],
    })
    createProfile.mockResolvedValue(undefined)
    renderRecipients(true)

    await userEvent.type(getInput("#firstNameNew"), "Ada")
    await userEvent.type(getInput("#surnameNew"), "Lovelace")
    await userEvent.type(getInput("#emailNew"), "new@example.com")
    await userEvent.click(
      screen.getByRole("button", { name: "button.importUser" }),
    )

    await waitFor(() =>
      expect(createProfile).toHaveBeenCalledWith({
        profiles: [
          {
            email: "new@example.com",
            firstName: "Ada",
            lastName: "Lovelace",
          },
        ],
      }),
    )
    await waitFor(() =>
      expect(toasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      ),
    )
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("does not select a newly created recipient who opted out", async () => {
    clientFetch.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
      data: [
        {
          ...recipient,
          id: "new-profile",
          consentStatuses: { messaging: { status: "pending" } },
        },
      ],
    })
    createProfile.mockResolvedValue(undefined)
    renderRecipients(true)
    await userEvent.type(getInput("#emailNew"), "new@example.com")

    await userEvent.click(
      screen.getByRole("button", { name: "button.importUser" }),
    )

    await waitFor(() =>
      expect(toasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "toast.error.consentDisabled" }),
      ),
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it("reports create-profile failures and clears the add form", async () => {
    clientFetch.mockRejectedValue(new Error("failed"))
    renderRecipients(true)
    const email = getInput("#emailNew")
    await userEvent.type(email, "new@example.com")

    await userEvent.click(
      screen.getByRole("button", { name: "button.importUser" }),
    )
    await waitFor(() =>
      expect(toasterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "toast.error.database" }),
      ),
    )

    await userEvent.click(
      screen.getAllByRole("button", { name: "button.reset" })[1],
    )
    expect(email).toHaveValue("")
  })
})
