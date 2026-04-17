import { cookies } from "next/headers.js"
import { SELECTED_ORG_COOKIE_NAME } from "./constants.js"
import type { SelectedOrganization } from "./types.js"

export const SelectedOrganizationHandler: SelectedOrganization = {
  set(
    organizationId: string,
    secure: boolean,
    overwrite = false,
    domain?: string,
  ): void {
    if (!overwrite && SelectedOrganizationHandler.isSet()) {
      return
    }
    cookies().set(SELECTED_ORG_COOKIE_NAME, organizationId, { secure, domain })
  },
  get(): string | undefined {
    const value = cookies().get(SELECTED_ORG_COOKIE_NAME)
    if (!value) {
      return undefined
    }

    return value.value
  },
  delete(): void {
    cookies().delete(SELECTED_ORG_COOKIE_NAME)
  },
  isSet(): boolean {
    return cookies().has(SELECTED_ORG_COOKIE_NAME)
  },
}
