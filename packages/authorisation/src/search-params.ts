import { POST_LOGIN_SEARCH_PARAMS } from "./constants"

export type PreLoginParams = {
  loginUrl?: string | null
  postLoginRedirectPath?: string | null
}

export const parsePreLoginParams = (
  searchParams: URLSearchParams,
): PreLoginParams => {
  return {
    loginUrl: searchParams.get(POST_LOGIN_SEARCH_PARAMS.LoginUrl) ?? "/",
    postLoginRedirectPath: searchParams.get(
      POST_LOGIN_SEARCH_PARAMS.PostLoginRedirectPath,
    ),
  }
}

export const buildPreLoginSearch = (params: PreLoginParams): string => {
  const qp = new URLSearchParams()
  if (params.loginUrl)
    qp.set(POST_LOGIN_SEARCH_PARAMS.LoginUrl, params.loginUrl)
  if (params.postLoginRedirectPath)
    qp.set(
      POST_LOGIN_SEARCH_PARAMS.PostLoginRedirectPath,
      params.postLoginRedirectPath,
    )
  return qp.toString()
}
