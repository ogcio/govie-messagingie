import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("@/components/profile-admin/my-profile", () => ({
  MyProfile: () => <div data-testid='my-profile' />,
}))

import MyProfilePage from "./page"

it("renders the profile view", () => {
  render(<MyProfilePage />)
  expect(screen.getByTestId("my-profile")).toBeInTheDocument()
})
