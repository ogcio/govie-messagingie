export const createPreSignoutHandler = (preLogout: () => Promise<void>) => {
  return async () => {
    await preLogout()
  }
}
