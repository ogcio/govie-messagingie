"use client"

import {
  Button,
  FormField,
  FormFieldLabel,
  ModalBody,
  ModalFooter,
  ModalTitle,
  ModalWrapper,
  Paragraph,
  Stack,
} from "@ogcio/design-system-react"
import {
  SelectItem,
  SelectNative,
} from "@ogcio/design-system-react/select/select-native"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"
import type { MoveDestination } from "@/types/folder"
import styles from "./move-message-modal.module.css"

export interface MoveMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (folderId: string | null) => void
  destinations: MoveDestination[]
  isMoving?: boolean
}

export function MoveMessageModal({
  isOpen,
  onClose,
  onConfirm,
  destinations,
  isMoving = false,
}: MoveMessageModalProps) {
  const t = useTranslations("home.move.modal")
  const [selectedId, setSelectedId] = useState<string>("")

  useEffect(() => {
    if (!isOpen) return
    const first = destinations[0]
    setSelectedId(first ? String(first.id ?? "inbox") : "")
  }, [isOpen, destinations])

  const resolveSelectedFolderId = useCallback((): string | null => {
    if (selectedId === "inbox") return null
    return selectedId || null
  }, [selectedId])

  const handleConfirm = useCallback(() => {
    onConfirm(resolveSelectedFolderId())
  }, [onConfirm, resolveSelectedFolderId])

  const handleMobileSelect = useCallback(
    (folderId: string | null) => {
      onConfirm(folderId)
    },
    [onConfirm],
  )

  const hasDestinations = destinations.length > 0

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      position='center'
      closeOnOverlayClick={!isMoving}
      closeOnEscape={!isMoving}
      closeButtonLabel={t("close")}
      dataTestId='move-message-modal'
    >
      <ModalTitle>{t("title")}</ModalTitle>
      <ModalBody>
        {hasDestinations ? (
          <>
            <div className={styles.desktopSelect}>
              <FormField>
                <FormFieldLabel
                  text={t("chooseFolder")}
                  htmlFor='move-folder'
                />
                <SelectNative
                  id='move-folder'
                  data-testid='move-folder-select'
                  value={selectedId}
                  disabled={isMoving}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setSelectedId(e.target.value)
                  }
                >
                  {destinations.map((dest) => (
                    <SelectItem
                      key={dest.id ?? "inbox"}
                      value={String(dest.id ?? "inbox")}
                    >
                      {dest.label}
                    </SelectItem>
                  ))}
                </SelectNative>
              </FormField>
            </div>
            <Stack
              direction='column'
              gap={0}
              className={styles.mobileList}
              itemsAlignment='stretch'
            >
              {destinations.map((dest) => (
                <button
                  key={dest.id ?? "inbox"}
                  type='button'
                  className={styles.mobileFolderItem}
                  data-testid={`move-folder-option-${dest.id ?? "inbox"}`}
                  disabled={isMoving}
                  onClick={() => handleMobileSelect(dest.id)}
                >
                  {dest.label}
                </button>
              ))}
            </Stack>
          </>
        ) : (
          <Paragraph>{t("noFolders")}</Paragraph>
        )}
      </ModalBody>
      <ModalFooter orientation='horizontal'>
        {hasDestinations ? (
          [
            <Button
              key='cancel'
              variant='secondary'
              appearance='default'
              onClick={onClose}
              disabled={isMoving}
              className={styles.desktopFooterButton}
              data-testid='move-confirmation-cancel'
            >
              {t("cancel")}
            </Button>,
            <Button
              key='confirm'
              variant='primary'
              appearance='default'
              onClick={handleConfirm}
              disabled={isMoving || !selectedId}
              ariaBusy={isMoving}
              className={styles.desktopFooterButton}
              data-testid='move-confirmation-confirm'
            >
              {t("move")}
            </Button>,
          ]
        ) : (
          <Button
            variant='secondary'
            appearance='default'
            onClick={onClose}
            data-testid='move-confirmation-cancel'
          >
            {t("close")}
          </Button>
        )}
      </ModalFooter>
    </ModalWrapper>
  )
}
