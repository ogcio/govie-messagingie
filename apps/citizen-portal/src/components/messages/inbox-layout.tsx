"use client"

import type { ReactNode } from "react"
import styles from "./inbox-layout.module.css"

export interface InboxLayoutProps {
  sidebar: ReactNode
  children: ReactNode
}

export function InboxLayout({ sidebar, children }: InboxLayoutProps) {
  return (
    <div className={styles.inboxLayout}>
      <aside className={styles.sidebar}>{sidebar}</aside>
      <div className={`${styles.main} inboxLayoutMain`}>{children}</div>
    </div>
  )
}
