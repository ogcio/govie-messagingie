"use client"

import { ListCard } from "@/components/list-card/list-card"

/**
 * Static showcase of every ListCard visual state for demo screenshots.
 * Public route — no auth or API dependencies.
 */
export default function ListCardStatesDemoPage() {
  return (
    <main
      data-testid='list-card-states-demo'
      className='gi-flex gi-flex-col gi-bg-white'
      style={{ maxWidth: "24rem", margin: "0 auto" }}
    >
      <ListCard
        title='Department of Education'
        date={<time dateTime='2026-07-02'>2 Jul 2026</time>}
        preview='Please find attached your payslip for the month of August.'
        hasAttachment
        isUnread
      />
      <ListCard
        title='Department of Education'
        date={<time dateTime='2026-07-02'>2 Jul 2026</time>}
        preview='Please find attached your payslip for the month of August.'
        hasAttachment
      />
      <ListCard
        title='Department of Education'
        date={<time dateTime='2026-07-02'>2 Jul 2026</time>}
        preview='Please find attached your payslip for the month of August.'
        hasAttachment
        showCheckbox
        isChecked={false}
      />
      <ListCard
        title='Department of Education'
        date={<time dateTime='2026-07-02'>2 Jul 2026</time>}
        preview='Please find attached your payslip for the month of August.'
        hasAttachment
        isUnread
        showCheckbox
        isChecked
        isSelected
      />
      <ListCard
        title='Department of Education'
        date={<time dateTime='2026-07-02'>2 Jul 2026</time>}
        preview='Please find attached your payslip for the month of August.'
        showCheckbox
        isChecked
        isSelected
      />
      <ListCard
        title='Department of Education'
        date={<time dateTime='2026-07-02'>2 Jul 2026</time>}
        preview='Please find attached your payslip for the month of August.'
      />
    </main>
  )
}
