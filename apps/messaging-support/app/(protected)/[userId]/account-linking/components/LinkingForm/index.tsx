"use client"

import {
  Alert,
  Button,
  Container,
  Paragraph,
  toaster,
} from "@ogcio/design-system-react"
import { useAnalytics } from "@ogcio/nextjs-analytics"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { ANALYTICS } from "@/const/analytics"
import type { LinkProfile } from "@/data/types"
import { linkAccountsAction } from "@/utils/actions"
import { AlreadyLinkedProfile } from "./AlreadyLinkedProfile"
import { CircularProfile } from "./CircularProfile"
import { ConfirmLinkForm } from "./ConfirmLinkForm"
import { LookupForm } from "./LookupForm"

type LookupState =
  | { status: "idle" }
  | { status: "resolved"; profile: LinkProfile }
  | { status: "resolved:circular-reference"; profile: LinkProfile }
  | { status: "resolved:has-links"; profile: LinkProfile }

export function LinkingForms(props: { toSetAsParentId: string }) {
  const { toSetAsParentId } = props
  const [lookupState, setLookupState] = useState<LookupState>({
    status: "idle",
  })
  const [isLinkingPending, startTransition] = useTransition()
  const [linkError, setLinkError] = useState<string | null>(null)
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const analyticsClient = useAnalytics()

  function handleLinkEventTracking(): void {
    analyticsClient.trackEvent({
      event: {
        name: ANALYTICS.linking.link.name,
        category: ANALYTICS.linking.category,
        action: ANALYTICS.linking.link.action,
      },
    })
  }

  function handleLookupSubmit(profile: LinkProfile) {
    if (
      profile.id === toSetAsParentId ||
      profile.links.some((link) => link.id === toSetAsParentId)
    ) {
      setLookupState({ status: "resolved:circular-reference", profile })
    } else if (profile.links.length) {
      setLookupState({ status: "resolved:has-links", profile })
    } else {
      setLookupState({ status: "resolved", profile })
    }
  }

  const searchParamsStatus = params?.get("status")
  /**
   * Explicitly used by Unlink component, to signal that we can reset
   * the lookupState to idle, to avoid confusions.
   *
   * This consumes the search Param "status"
   */
  useEffect(() => {
    if (!searchParamsStatus) {
      return
    }

    const nextParams = new URLSearchParams(params.toString())
    nextParams.delete("status")
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false })
    setLookupState({ status: "idle" })
  }, [searchParamsStatus, params, pathname, router])

  function handleCancel() {
    setLookupState({ status: "idle" })
  }

  async function handleLinkSubmit(profileId: string) {
    startTransition(async () => {
      const linkResult = await linkAccountsAction({
        profileId,
        primaryUserId: toSetAsParentId,
      })

      if (!linkResult.success) {
        return setLinkError(linkResult.userMessage)
      }
      setLookupState({ status: "idle" })
      handleLinkEventTracking()
      router.refresh()
      toaster.create({
        title: "Success!",
        description: "Accounts are now linked",
        duration: 2000,
        position: { x: "right", y: "top" },
        variant: "success",
        animation: "fadeinright",
      })
    })
  }

  if (linkError) {
    return (
      <Container insetBottom='lg' insetTop='lg'>
        <Alert variant='danger' title='Failed to link accounts'>
          <span>{linkError}</span>
          <Button onClick={() => setLinkError(null)}>Close</Button>
        </Alert>
      </Container>
    )
  }

  switch (lookupState.status) {
    case "idle":
      return <LookupForm submitCallback={handleLookupSubmit} />
    case "resolved":
      return (
        <ConfirmLinkForm
          profile={lookupState.profile}
          primaryProfileId={toSetAsParentId}
          onFormCancel={handleCancel}
          onFormSubmit={handleLinkSubmit}
          isPending={isLinkingPending}
        />
      )
    case "resolved:circular-reference":
      return (
        <CircularProfile
          profile={lookupState.profile}
          onCancel={handleCancel}
        />
      )
    case "resolved:has-links":
      return (
        <AlreadyLinkedProfile
          profile={lookupState.profile}
          onCancel={handleCancel}
        />
      )
    default:
      return (
        <Container>
          <Alert variant='danger' title='Oh no!'>
            <Paragraph>
              Something unexpected happened. Try reloading the page.
            </Paragraph>
          </Alert>
        </Container>
      )
  }
}
