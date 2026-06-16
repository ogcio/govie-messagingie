type SearchParamsLike = { toString(): string }

export function buildLocaleSwitchHref(
  path: string,
  locale: string,
  oppositeLocale: string,
  searchParams?: SearchParamsLike | null,
): string {
  const basePath = path.includes(`/${locale}/`)
    ? path.replace(`/${locale}/`, `/${oppositeLocale}/`)
    : `/${oppositeLocale}`
  const query = searchParams?.toString()
  return query ? `${basePath}?${query}` : basePath
}
