"use client"

import { Heading } from "@ogcio/design-system-react"
import type { ReactNode } from "react"
import styles from "./dashboard-panel.module.css"

export interface DashboardPanelProps {
  title: string
  /** Bottom-pinned call to action (e.g. "View all …" button). */
  cta?: ReactNode
  children: ReactNode
}

/**
 * Bordered, padded card that holds a dashboard preview list. Shared by the
 * recent-applications and recent-messages columns so both have identical
 * chrome and stretch to equal height in the two-column grid.
 *
 * The list body is full-bleed so the inbox `ListCard` rows' dividers and
 * hover/unread backgrounds span the full box width; the heading and CTA are
 * inset to line up with the rows' text.
 */
export function DashboardPanel({ title, cta, children }: DashboardPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <Heading as='h3'>{title}</Heading>
      </div>
      <div className={styles.body}>{children}</div>
      {cta ? <div className={styles.cta}>{cta}</div> : null}
    </section>
  )
}
