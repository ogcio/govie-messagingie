"use client"

import {
  Alert,
  Button,
  InputCheckbox,
  Paragraph,
  Stack,
  toaster,
} from "@ogcio/design-system-react"
import { useAnalytics } from "@ogcio/nextjs-analytics"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { ANALYTICS } from "@/const/analytics"
import type { MainProfile } from "@/data/types"
import { deleteAccountAction } from "@/utils/actions"

export function DeleteAccountSection(props: { profile: MainProfile }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const analyticsClient = useAnalytics()

  const { profile } = props
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [checks, setChecks] = useState({
    permanent: false,
    authority: false,
    verified: false,
  })

  const allChecked = checks.permanent && checks.authority && checks.verified

  function handleDeleteEventTracking(): void {
    analyticsClient.trackEvent({
      event: {
        name: ANALYTICS.management.delete.name,
        category: ANALYTICS.management.category,
        action: ANALYTICS.management.delete.action,
      },
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      // Auditing happens inside deleteAccountAction: @/data/audit needs
      // server-side env config and cannot run in the browser.
      const result = await deleteAccountAction({ profileId: profile.id })

      handleDeleteEventTracking()

      if (!result.success) {
        toaster.create({
          title: "Error!",
          description: "User was not deleted",
          duration: 2000,
          position: { x: "right", y: "top" },
          variant: "danger",
          animation: "fadeinright",
        })
        return
      }

      const qs = searchParams?.toString()
      toaster.create({
        title: "Success!",
        description: "User successfully deleted",
        duration: 2000,
        position: { x: "right", y: "top" },
        variant: "success",
        animation: "fadeinright",
      })
      await new Promise((resolve) => setTimeout(resolve, 2500))
      router.push(`/${qs ? `?${qs}` : ""}`)
    })
  }

  const handleCancel = () => {
    setShowConfirmation(false)
    setChecks({ permanent: false, authority: false, verified: false })
  }

  if (!showConfirmation) {
    return (
      <Button
        variant='primary'
        style={{ backgroundColor: "var(--gieds-color-red-600, #d32f2f)" }}
        onClick={() => setShowConfirmation(true)}
      >
        Delete Account
      </Button>
    )
  }

  return (
    <>
      <Alert variant='warning' title='Warning'>
        <Paragraph size='sm'>
          You are about to permanently delete this account for{" "}
          {profile.publicName}. This cannot be undone. Please confirm by
          checking the boxes below.
        </Paragraph>
      </Alert>
      <InputCheckbox
        checked={checks.permanent}
        onChange={() =>
          setChecks((prev) => ({ ...prev, permanent: !prev.permanent }))
        }
        label='I understand deletion is permanent'
        hint='All data will be erased.'
      />
      <InputCheckbox
        checked={checks.authority}
        onChange={() =>
          setChecks((prev) => ({ ...prev, authority: !prev.authority }))
        }
        label='I confirm I have authority to delete this account'
        hint='I am an authorised user.'
      />
      <InputCheckbox
        checked={checks.verified}
        onChange={() =>
          setChecks((prev) => ({ ...prev, verified: !prev.verified }))
        }
        label='I have verified this is the account I wish to delete'
        hint='Name, Email, and PPSN match the intended use.'
      />

      <Stack direction='row' itemsDistribution='between' gap={16}>
        <Button
          variant='primary'
          style={{
            backgroundColor: allChecked
              ? "var(--gieds-color-red-600, #d32f2f)"
              : undefined,
          }}
          disabled={!allChecked || isPending}
          onClick={handleDelete}
        >
          {isPending ? "Deleting..." : "Delete Account"}
        </Button>
        <Button variant='secondary' onClick={handleCancel} disabled={isPending}>
          Cancel
        </Button>
      </Stack>
    </>
  )
}
