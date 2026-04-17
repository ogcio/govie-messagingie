import type { NextRequest } from "next/server"

export const createAfterLoginHandler = (login: () => Promise<void>) => {
  return async (_request: NextRequest) => {
    await login()
  }
}
