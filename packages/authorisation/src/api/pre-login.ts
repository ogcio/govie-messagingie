import type { NextRequest } from "next/server"

export const createPreLoginHandler = (
  preLogin: (searchParams: URLSearchParams) => Promise<void>,
) => {
  return async (request: NextRequest) => {
    await preLogin(request.nextUrl.searchParams)
  }
}
