import { headers } from "next/headers"
import type { CustomHeaders } from "./types"

export const createGetCurrentPath = (customHeaders: CustomHeaders) => {
  return (): string => {
    return headers().get(customHeaders.Pathname) ?? ""
  }
}

export const createGetCurrentSearch = (customHeaders: CustomHeaders) => {
  return (): string => {
    return headers().get(customHeaders.Search) ?? ""
  }
}

export const createGetCurrentAbsoluteUrl = (customHeaders: CustomHeaders) => {
  return (baseUrl: string): URL | string => {
    const path = createGetCurrentPath(customHeaders)()
    return path ? new URL(path, baseUrl) : baseUrl
  }
}
