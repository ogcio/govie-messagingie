import { CssSpinner } from "@/components/css-spinner"
import styles from "./inbox-unread-badge.module.css"
import { useInboxUnreadCount } from "./use-inbox-unread-count"

export function InboxUnreadBadge() {
  const { count, isLoading } = useInboxUnreadCount()

  if (isLoading) {
    return (
      <span className={styles.badge} aria-hidden>
        <CssSpinner size='sm' />
      </span>
    )
  }

  if (count <= 0) {
    return null
  }

  return (
    <span className={styles.badge} aria-hidden>
      {count}
    </span>
  )
}
