"use client"

import {
  Button,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalWrapper,
  Paragraph,
} from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"

export interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  count: number
  isDeleting?: boolean
}

/**
 * Single confirmation modal used for both individual (count = 1) and bulk
 * delete. Copy pluralises via `home.delete.confirm.body`. RFC Open Q2
 * resolution: always ask before soft-deleting.
 */
export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  count,
  isDeleting = false,
}: DeleteConfirmationModalProps) {
  const t = useTranslations("home.delete.confirm")

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      position='center'
      closeOnOverlayClick={!isDeleting}
      closeOnEscape={!isDeleting}
      closeButtonLabel={t("close")}
      dataTestId='delete-confirmation-modal'
    >
      <ModalTitle>{t("title", { count })}</ModalTitle>
      <ModalBody>
        <Paragraph>{t("body", { count })}</Paragraph>
      </ModalBody>
      <ModalFooter orientation='horizontal'>
        <Button
          variant='secondary'
          appearance='default'
          onClick={onClose}
          disabled={isDeleting}
          data-testid='delete-confirmation-cancel'
        >
          {t("cancel")}
        </Button>
        <Button
          variant='primary'
          appearance='default'
          onClick={onConfirm}
          disabled={isDeleting}
          ariaBusy={isDeleting}
          data-testid='delete-confirmation-confirm'
        >
          {t("cta")}
        </Button>
      </ModalFooter>
    </ModalWrapper>
  )
}
