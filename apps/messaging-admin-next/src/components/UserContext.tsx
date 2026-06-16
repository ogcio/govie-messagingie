"use client"

import {
  PROFILE_PUBLIC_SERVANT_ROLE_NAME,
  UPLOAD_PUBLIC_SERVANT_ROLE_NAME,
  useAuth,
} from "@ogcio/sag-client/react"
import { createContext, useContext } from "react"
import { useOrganizationContext } from "@/hooks/use-organization-context"
import type { AppUser } from "@/types/types"

const UserContext = createContext<{ user: AppUser | undefined }>({
  user: undefined,
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user, claims } = useAuth()
  const { currentOrganization, organizations } = useOrganizationContext()

  if (!user || !claims) {
    return null
  }

  const orgRoles = currentOrganization?.roles ?? []
  const appUser: AppUser = {
    id: user.sub,
    isPublicServant: true,
    isInactivePublicServant: false,
    name: user.name ?? user.email,
    currentOrganization: currentOrganization
      ? {
          id: currentOrganization.id,
          name: currentOrganization.name,
          roles: orgRoles,
        }
      : undefined,
    organizations: organizations.map((o) => ({
      id: o.id,
      name: o.name,
      roles: o.roles ?? [],
    })),
  }

  return (
    <UserContext.Provider value={{ user: appUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): AppUser {
  const { user } = useContext(UserContext)
  if (!user) {
    throw new Error("useUser must be used within UserProvider")
  }
  return user
}

export function useUserRoles() {
  const user = useUser()
  return {
    canCreateProfiles:
      user.currentOrganization?.roles.includes(
        PROFILE_PUBLIC_SERVANT_ROLE_NAME,
      ) ?? false,
    canUploadFiles:
      user.currentOrganization?.roles.includes(
        UPLOAD_PUBLIC_SERVANT_ROLE_NAME,
      ) ?? false,
  }
}
