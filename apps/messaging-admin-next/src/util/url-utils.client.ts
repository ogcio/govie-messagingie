import { env } from "@/env/env.client"
import { cleanUrl } from "./clean-url"

function buildClientUrlWithSearchParams({
  dir,
  locale,
  searchParams,
}: {
  locale?: string | null
  dir: string
  searchParams: { [key: string]: string | string[] } | undefined
}): URL {
  const url = buildClientUrl({ locale, url: dir })
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          url.searchParams.append(key, v)
        }
      } else {
        url.searchParams.append(key, value)
      }
    }
  }
  return url
}

function buildClientUrl({
  locale,
  url: path,
}: {
  locale?: string | null
  url: string | null
}) {
  const joined = [cleanUrl(locale), cleanUrl(path)].join("/")
  return new URL(joined, env.NEXT_PUBLIC_BASE_URL)
}

export { buildClientUrl, buildClientUrlWithSearchParams }
