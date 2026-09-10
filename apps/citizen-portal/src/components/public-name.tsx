"use client"

import { useAuth } from "@ogcio/sag-client/react"
import { Skeleton } from "@/components/skeleton/skeleton"
import { usePublicName } from "@/hooks/use-public-name"

export interface PublicNameProps {
  /** Skeleton width while the name loads. Match the surrounding text. */
  skeletonWidth?: string
}

/**
 * Renders the signed-in user's display name, showing a `<Skeleton>` until the
 * profile lookup settles.
 *
 * Every surface that shows the name must go through here, or they disagree:
 * the drawer rendered Logto's `name` claim while the dashboard heading
 * rendered the profile service's `publicName`, showing two names at once.
 *
 * The skeleton is decorative (`aria-hidden`), so the wrapper carries
 * `aria-busy` — otherwise assistive tech reads an empty inline region.
 */
export function PublicName({ skeletonWidth = "10rem" }: PublicNameProps) {
  const { user } = useAuth()
  const { publicName, isLoading } = usePublicName(user)

  if (isLoading) {
    return (
      <span aria-busy='true'>
        <Skeleton width={skeletonWidth} dataTestid='public-name-skeleton' />
      </span>
    )
  }

  return <>{publicName}</>
}
