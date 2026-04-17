export const createApplicationSignoutHandler = (
  applicationLogout: () => Promise<import("next/server").NextResponse>,
) => {
  return async () => {
    return applicationLogout()
  }
}
