"use client"

import { Icon, type IconProps, Link } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { useCallback } from "react"
import styles from "./message-detail.module.css"

export interface MessageDetailToolbarProps {
  onMove: () => void
  onDelete: () => void
  isDeleting?: boolean
  isMoving?: boolean
}

export function MessageDetailToolbar({
  onMove,
  onDelete,
  isDeleting = false,
  isMoving = false,
}: MessageDetailToolbarProps) {
  const tBack = useTranslations("home.button")
  const tMove = useTranslations("home.move")
  const tDetail = useTranslations("home.detail")

  const goBack = useCallback(() => {
    window.history.back()
  }, [])

  const actionDisabled = isDeleting || isMoving

  return (
    <nav className={styles.toolbar} aria-label={tDetail("toolbarAriaLabel")}>
      <Link
        noColor
        href='#'
        className={styles.toolbarAction}
        aria-label={tBack("back")}
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          goBack()
        }}
      >
        <Icon
          icon='chevron_left'
          size='md'
          className={styles.toolbarIcon}
          ariaHidden
        />
        {tBack("back")}
      </Link>
      <Link
        noColor
        href='#'
        className={styles.toolbarAction}
        data-testid='detail-move-button'
        aria-disabled={actionDisabled}
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          if (actionDisabled) return
          onMove()
        }}
      >
        <Icon
          icon={"drive_file_move" as IconProps["icon"]}
          size='md'
          className={styles.toolbarIcon}
          ariaHidden
        />
        {tMove("toolbar")}
      </Link>
      <Link
        noColor
        href='#'
        className={styles.toolbarAction}
        data-testid='detail-delete-button'
        aria-disabled={actionDisabled}
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          if (actionDisabled) return
          onDelete()
        }}
      >
        <Icon
          icon='delete'
          size='md'
          className={styles.toolbarIcon}
          ariaHidden
        />
        {tDetail("delete")}
      </Link>
    </nav>
  )
}
