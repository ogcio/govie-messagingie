import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import NotFound from "./not-found"

it("renders the not-found message and return link", () => {
  render(<NotFound />)

  expect(
    screen.getByRole("heading", { name: "Page not found" }),
  ).toBeInTheDocument()
  expect(screen.getByRole("alert")).toHaveTextContent(
    "The page you are looking for could not be found.",
  )
  expect(screen.getByRole("link", { name: "Return to admin" })).toHaveAttribute(
    "href",
    "/en/send-a-message",
  )
})
