import type { NextRequest } from "next/server"
import { POST_REDIRECT_URI_PARAM } from "../constants"

export const createSignoutHandler = (
  logout: (redirectUrl?: string) => Promise<void>,
) => {
  return async (request: NextRequest) => {
    const redirectUrl = request.nextUrl.searchParams.get(
      POST_REDIRECT_URI_PARAM,
    )
    await logout(redirectUrl ?? undefined)
  }
}
