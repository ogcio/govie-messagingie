import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { Consent } from "@/data/types"
import { ConsentStatusTag } from "./ConsentStatusTag"

describe("ConsentStatusTag", () => {
  it.each([
    ["opted-in", "Accepted"],
    ["pre-approved", "Accepted"],
    ["opted-out", "Declined"],
    ["pending", "Pending"],
    ["undefined", "Pending"],
  ] as const)("renders %s as %s", (status, text) => {
    render(<ConsentStatusTag status={status} />)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it("renders nothing for an unknown status", () => {
    const { container } = render(
      <ConsentStatusTag status={"bogus" as Consent["status"]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
