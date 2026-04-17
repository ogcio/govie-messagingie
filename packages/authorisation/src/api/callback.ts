import type { NextRequest } from "next/server"

export const createCallbackHandler = (
  loginCallback: (searchParams: URLSearchParams) => Promise<void>,
) => {
  return async (request: NextRequest) => {
    await loginCallback(request.nextUrl.searchParams)
  }
}
