"use client"

import {
  Alert,
  Button,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalWrapper,
  Paragraph,
  Spinner,
  toaster,
} from "@ogcio/design-system-react"
import { useAnalytics } from "@ogcio/nextjs-analytics"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { ANALYTICS } from "@/const/analytics"
import type { LinkProfile } from "@/data/types"
import { linkAccountsAction } from "@/utils/actions"

export function Unlink(props: {
  profile: LinkProfile["links"][number]
  canonicalProfileId: string
}) {
  const { profile, canonicalProfileId } = props
  const [isPendingUnlinking, startTransition] = useTransition()
  const [isUnlinkError, setUnlinkError] = useState(false)
  const [isOpen, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const analyticsClient = useAnalytics()

  function handleUnlinkEventTracking(): void {
    analyticsClient.trackEvent({
      event: {
        name: ANALYTICS.linking.unlink.name,
        category: ANALYTICS.linking.category,
        action: ANALYTICS.linking.unlink.action,
      },
    })
  }

  const handleUnlickClick = () => {
    setUnlinkError(false)
    startTransition(async () => {
      const unlinkResult = await linkAccountsAction({
        profileId: profile.isPrimary ? canonicalProfileId : profile.id,
        primaryUserId: null,
      })

      if (!unlinkResult.success) {
        setUnlinkError(true)
        return
      }
      handleUnlinkEventTracking()
      router.refresh()

      const nextparams = new URLSearchParams(searchParams.toString())
      nextparams.set("status", "idle")
      router.replace(`${pathname}?${nextparams.toString()}`)
      setOpen(false)
      toaster.create({
        title: "Success!",
        description: "Accounts are now unlinked",
        duration: 2000,
        position: { x: "right", y: "top" },
        variant: "success",
        animation: "fadeinright",
      })
    })
  }
  return (
    <>
      <Button variant='secondary' size='small' onClick={() => setOpen(true)}>
        Unlink
      </Button>
      <ModalWrapper
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        closeOnOverlayClick={false}
      >
        <ModalTitle>Unlink {profile.name}</ModalTitle>
        <ModalBody>
          <Paragraph>
            This will unlink {profile.name} from the canonical profile. Are you
            sure you want to proceed?
          </Paragraph>
          {isUnlinkError && (
            <Alert variant='danger' title='Failed to unlink accounts'>
              <Paragraph>
                Something went wrong and we couldn't unlink the accounts. Please
                try again.
              </Paragraph>
            </Alert>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant='secondary'
            hidden={isPendingUnlinking}
            disabled={isPendingUnlinking}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant='primary'
            onClick={handleUnlickClick}
            disabled={isPendingUnlinking}
            dataTestid='submit-unlink-btn'
          >
            {isPendingUnlinking && <Spinner />}
            Unlink
          </Button>
        </ModalFooter>
      </ModalWrapper>
    </>
  )
}
