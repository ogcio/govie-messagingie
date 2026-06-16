export const cleanUrl = (url: string | null | undefined) =>
  url?.replace(/^\/|\/$/g, "")
