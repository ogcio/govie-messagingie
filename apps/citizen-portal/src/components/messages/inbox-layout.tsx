"use client"

import type { ReactNode } from "react"
import styles from "./inbox-layout.module.css"

export interface InboxLayoutProps {
  sidebar?: ReactNode | null
  children: ReactNode
}

export function InboxLayout({ sidebar, children }: InboxLayoutProps) {
  return (
    <div className={sidebar ? styles.inboxLayout : styles.inboxLayoutNoSidebar}>
      {sidebar ? <aside className={styles.sidebar}>{sidebar}</aside> : null}
      <div className={`${styles.main} inboxLayoutMain`}>{children}</div>
    </div>
  )
}
