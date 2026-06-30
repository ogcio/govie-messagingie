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

export interface DeleteFolderModalProps {
  isOpen: boolean
  folderName: string
  isDeleting?: boolean
  onClose: () => void
  onConfirm: () => void
}

/**
 * Confirms folder deletion. The backend reassigns the folder's messages back
 * to the inbox before removing the tag, so the copy warns the user that
 * messages will be restored rather than lost.
 */
export function DeleteFolderModal({
  isOpen,
  folderName,
  isDeleting = false,
  onClose,
  onConfirm,
}: DeleteFolderModalProps) {
  const t = useTranslations("home.folders")

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      position='center'
      closeOnOverlayClick={!isDeleting}
      closeOnEscape={!isDeleting}
      closeButtonLabel={t("close")}
      dataTestId='delete-folder-modal'
    >
      <ModalTitle>
        {t("deleteConfirm.title", { folder: folderName })}
      </ModalTitle>
      <ModalBody>
        <Paragraph>{t("deleteConfirm.body")}</Paragraph>
      </ModalBody>
      <ModalFooter orientation='horizontal'>
        <Button
          variant='secondary'
          appearance='default'
          onClick={onClose}
          disabled={isDeleting}
          data-testid='delete-folder-cancel'
        >
          {t("deleteConfirm.cancel")}
        </Button>
        <Button
          variant='primary'
          appearance='default'
          onClick={onConfirm}
          disabled={isDeleting}
          ariaBusy={isDeleting}
          data-testid='delete-folder-confirm'
        >
          {t("deleteConfirm.cta")}
        </Button>
      </ModalFooter>
    </ModalWrapper>
  )
}
