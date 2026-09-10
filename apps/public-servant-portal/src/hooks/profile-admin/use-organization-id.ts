"use client"

import { useAuth } from "@ogcio/sag-client/react"
import { useOrganizationContext } from "./use-organization-context"

/**
 * Returns the id of the user's currently active organization for admin
 * actions. Prefers the gateway-persisted selection (signed `sag_selected_org`
 * cookie) so that org-switches via the user-menu drawer take effect; falls
 * back to the first organization in the auth claims for the initial render.
 *
 * The Secure API Gateway forwards organization-scoped admin scopes
 * (`profile:user.admin:*`) only when the proxied request resolves an
 * organization id from this cookie or the `X-Organization-Id` header.
 */
export function useOrganizationId(): string | undefined {
  const { currentOrganization } = useOrganizationContext()
  const { claims } = useAuth()
  return currentOrganization?.id ?? claims?.organizations?.[0]
}
