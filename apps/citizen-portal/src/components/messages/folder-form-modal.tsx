"use client"

import {
  Button,
  FormField,
  FormFieldError,
  FormFieldLabel,
  InputText,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalWrapper,
} from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

/** Backend caps folder labels at 100 chars (CreateTagBodySchema maxLength). */
export const FOLDER_NAME_MAX_LENGTH = 100

export interface FolderSaveOutcome {
  ok: boolean
  /** True when the name collided with an existing folder (HTTP 409). */
  conflict?: boolean
}

export interface FolderFormModalProps {
  isOpen: boolean
  mode: "create" | "rename"
  /** Pre-filled value for rename; ignored for create. */
  initialValue?: string
  onClose: () => void
  /** Performs the create/rename mutation and reports the outcome. */
  onSubmit: (name: string) => Promise<FolderSaveOutcome>
  /** Called after a successful save so the parent can toast + refresh + close. */
  onSuccess: () => void
}

/**
 * Reusable modal for naming a folder. Drives both the create and rename
 * flows: the only differences are the title and the pre-filled value. Save is
 * disabled until the input holds a non-blank name; a 409 from the API surfaces
 * as an inline duplicate-name error without closing the modal.
 */
export function FolderFormModal({
  isOpen,
  mode,
  initialValue = "",
  onClose,
  onSubmit,
  onSuccess,
}: FolderFormModalProps) {
  const t = useTranslations("home.folders")
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<"duplicate" | "generic" | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue)
      setError(null)
      setIsSaving(false)
    }
  }, [isOpen, initialValue])

  const trimmed = value.trim()
  const canSave = trimmed.length > 0 && !isSaving

  const handleSave = async () => {
    if (!canSave) return
    setError(null)
    setIsSaving(true)
    const outcome = await onSubmit(trimmed)
    setIsSaving(false)
    if (outcome.ok) {
      onSuccess()
    } else {
      setError(outcome.conflict ? "duplicate" : "generic")
    }
  }

  const errorText =
    error === "duplicate"
      ? t("error.duplicate")
      : error === "generic"
        ? t("error.generic")
        : undefined

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      position='center'
      closeOnOverlayClick={!isSaving}
      closeOnEscape={!isSaving}
      closeButtonLabel={t("close")}
      dataTestId='folder-form-modal'
    >
      <ModalTitle>
        {mode === "create" ? t("createTitle") : t("renameTitle")}
      </ModalTitle>
      <ModalBody>
        <FormField>
          <FormFieldLabel text={t("nameLabel")} htmlFor='folder-name-input' />
          <InputText
            id='folder-name-input'
            data-testid='folder-name-input'
            type='text'
            value={value}
            maxLength={FOLDER_NAME_MAX_LENGTH}
            placeholder={t("placeholder")}
            disabled={isSaving}
            aria-invalid={error !== null}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setValue(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === "Enter") void handleSave()
            }}
          />
          {errorText ? (
            <FormFieldError text={errorText} dataTestid='folder-name-error' />
          ) : null}
        </FormField>
      </ModalBody>
      <ModalFooter orientation='horizontal'>
        <Button
          variant='secondary'
          appearance='default'
          onClick={onClose}
          disabled={isSaving}
          data-testid='folder-form-cancel'
        >
          {t("cancel")}
        </Button>
        <Button
          variant='primary'
          appearance='default'
          onClick={() => void handleSave()}
          disabled={!canSave}
          ariaBusy={isSaving}
          data-testid='folder-form-save'
        >
          {t("save")}
        </Button>
      </ModalFooter>
    </ModalWrapper>
  )
}
