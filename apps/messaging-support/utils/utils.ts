import type { NextSearchParams, ProfileData } from "@/data/types"

export function toURLSearchParams(params: NextSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        searchParams.append(key, v)
      }
    } else {
      searchParams.append(key, value)
    }
  }

  return searchParams
}

export function getFullName(profile: ProfileData): string {
  if (!profile) return "Unknown Name"
  return [profile.firstName, profile?.lastName].filter(Boolean).join(" ")
}
