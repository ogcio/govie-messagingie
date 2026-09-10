export const PAGINATION_PAGE_DEFAULT = 1
export const PAGINATION_LIMIT_DEFAULT = 20
export const PAGINATION_OFFSET_DEFAULT = 0

export const offsetToPage = (
  offset: number = PAGINATION_OFFSET_DEFAULT,
  limit: number = PAGINATION_LIMIT_DEFAULT,
) => {
  return Math.floor(offset / limit) + 1
}

export const pageToOffset = (
  page: number = PAGINATION_PAGE_DEFAULT,
  limit: number = PAGINATION_LIMIT_DEFAULT,
) => {
  return (page - 1) * limit
}
