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
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { ANALYTICS } from "@/const/analytics"
import type { ExportTask, MainProfile } from "@/data/types"
import { requestDataExportAction } from "@/utils/actions"

export function DataExportSection(props: {
  profile: MainProfile
  exportTask: ExportTask | null
  loadFailed: boolean
}) {
  const { profile, exportTask, loadFailed } = props
  const router = useRouter()
  const analyticsClient = useAnalytics()

  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [checks, setChecks] = useState({
    authority: false,
    verified: false,
    notNotified: false,
  })

  const allChecked = checks.authority && checks.verified && checks.notNotified

  const status = exportTask?.status
  const expiresAt = exportTask?.metadata?.expiresAt
    ? new Date(exportTask.metadata.expiresAt)
    : undefined
  const isInProgress = status === "pending" || status === "processing"
  const isFailed = status === "failed"
  const hasValidExport =
    status === "completed" && expiresAt !== undefined && expiresAt > new Date()

  const handleRequest = () => {
    startTransition(async () => {
      // Auditing happens inside requestDataExportAction: @/data/audit needs
      // server-side env config and cannot run in the browser.
      const result = await requestDataExportAction({ profileId: profile.id })

      analyticsClient.trackEvent({
        event: {
          name: ANALYTICS.management.exportRequested.name,
          category: ANALYTICS.management.category,
          action: ANALYTICS.management.exportRequested.action,
        },
      })

      if (!result.success) {
        toaster.create({
          title: "Error!",
          description: "Data export was not requested",
          duration: 2000,
          position: { x: "right", y: "top" },
          variant: "danger",
          animation: "fadeinright",
        })
        return
      }

      toaster.create({
        title: "Success!",
        description: "Data export requested",
        duration: 2000,
        position: { x: "right", y: "top" },
        variant: "success",
        animation: "fadeinright",
      })
      handleCancel()
      router.refresh()
    })
  }

  const handleCancel = () => {
    setShowConfirmation(false)
    setChecks({ authority: false, verified: false, notNotified: false })
  }

  return (
    <>
      {loadFailed && (
        <Alert variant='warning' title='Warning'>
          <Paragraph size='sm'>
            Could not load the export status for this account. Requesting a new
            export is still possible.
          </Paragraph>
        </Alert>
      )}

      {isInProgress && (
        <Alert variant='info' title='In progress'>
          <Paragraph size='sm'>
            A data export is in progress for this account.
          </Paragraph>
        </Alert>
      )}

      {isFailed && (
        <Alert variant='warning' title='Warning'>
          <Paragraph size='sm'>
            The last export failed for this account. Requesting a new one will
            retry it.
          </Paragraph>
        </Alert>
      )}

      {hasValidExport && expiresAt && (
        <Alert variant='success' title='Export available'>
          <Paragraph size='sm'>
            An export is available to the citizen until{" "}
            {expiresAt.toLocaleDateString("en-IE", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            . Requesting a new export replaces it.
          </Paragraph>
        </Alert>
      )}

      {!isInProgress && !showConfirmation && (
        <Button variant='primary' onClick={() => setShowConfirmation(true)}>
          Request Data Export
        </Button>
      )}

      {!isInProgress && showConfirmation && (
        <>
          <Alert variant='warning' title='Warning'>
            <Paragraph size='sm'>
              You are about to request a data export for {profile.publicName}.
              Please confirm by checking the boxes below.
            </Paragraph>
          </Alert>
          <InputCheckbox
            checked={checks.authority}
            onChange={() =>
              setChecks((prev) => ({ ...prev, authority: !prev.authority }))
            }
            label='I confirm I have authority to request this export'
            hint='I am an authorised user.'
          />
          <InputCheckbox
            checked={checks.verified}
            onChange={() =>
              setChecks((prev) => ({ ...prev, verified: !prev.verified }))
            }
            label='I have verified this is the account I wish to export'
            hint='Name, Email, and PPSN match the intended use.'
          />
          <InputCheckbox
            checked={checks.notNotified}
            onChange={() =>
              setChecks((prev) => ({
                ...prev,
                notNotified: !prev.notNotified,
              }))
            }
            label='I understand the citizen will not be notified'
            hint='Any export they currently hold is replaced and its download link stops working.'
          />

          <Stack direction='row' itemsDistribution='between' gap={16}>
            <Button
              variant='primary'
              disabled={!allChecked || isPending}
              onClick={handleRequest}
            >
              {isPending ? "Requesting..." : "Confirm Export"}
            </Button>
            <Button
              variant='secondary'
              onClick={handleCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          </Stack>
        </>
      )}
    </>
  )
}
