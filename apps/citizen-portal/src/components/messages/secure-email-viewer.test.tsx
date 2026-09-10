import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SecureEmailViewer } from "./secure-email-viewer"

const postMessage = vi.fn()
const close = vi.fn()
let onmessage: ((event: MessageEvent) => void) | null = null

class MessageChannelMock {
  port1 = {
    get onmessage() {
      return onmessage
    },
    set onmessage(handler: ((event: MessageEvent) => void) | null) {
      onmessage = handler
    },
    close,
  }

  port2 = {}
}

describe("SecureEmailViewer", () => {
  beforeEach(() => {
    postMessage.mockClear()
    close.mockClear()
    onmessage = null
    vi.stubGlobal("MessageChannel", MessageChannelMock)
  })

  it("isolates email HTML in a sandboxed, no-referrer document", () => {
    render(<SecureEmailViewer content='<p>Account update</p>' />)
    const iframe = screen.getByTitle("Secure email content viewer")

    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-forms allow-scripts allow-popups allow-popups-to-escape-sandbox",
    )
    expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer")
    expect(iframe.getAttribute("srcdoc")).toContain("<p>Account update</p>")
    expect(iframe.getAttribute("srcdoc")).toContain(
      'http-equiv="Content-Security-Policy"',
    )
  })

  it("transfers a height channel and applies reported iframe height", () => {
    render(<SecureEmailViewer content='Message' />)
    const iframe = screen.getByTitle(
      "Secure email content viewer",
    ) as HTMLIFrameElement
    Object.defineProperty(iframe, "contentWindow", {
      value: { postMessage },
      configurable: true,
    })

    fireEvent.load(iframe)
    expect(postMessage).toHaveBeenCalledWith(
      { type: "INIT_HEIGHT_PORT" },
      "*",
      expect.any(Array),
    )

    act(() => {
      onmessage?.({
        data: { type: "IFRAME_HEIGHT", height: 480 },
      } as MessageEvent)
    })
    expect(iframe).toHaveStyle({ height: "480px" })
  })
})
