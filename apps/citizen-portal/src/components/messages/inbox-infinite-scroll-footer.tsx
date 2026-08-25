"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import { CssSpinner } from "@/components/css-spinner"
import styles from "./inbox-infinite-scroll-footer.module.css"

export interface InboxInfiniteScrollFooterProps {
  /** More pages remain to be appended. */
  hasMore?: boolean
  /** A next page is currently being fetched. */
  isLoadingMore?: boolean
  /** Requests the next page. Absent (e.g. desktop) = infinite scroll off. */
  onLoadMore?: () => void
}

/**
 * Bottom-of-list sentinel that drives the mobile inbox infinite scroll.
 *
 * An `IntersectionObserver` watches the sentinel and asks the parent for the
 * next page when it scrolls into view (with a 200px pre-load margin). The
 * footer wrapper is mobile-only via CSS, so on desktop — where the table
 * footer keeps its own pagination — this renders nothing visible and the
 * observer never fires (`onLoadMore` is not supplied there).
 *
 * The latest `hasMore` / `isLoadingMore` / `onLoadMore` values are read from
 * refs inside the observer callback so the observer can stay subscribed for
 * the sentinel's whole lifetime instead of tearing down and re-attaching on
 * every fetch-state change (which could drop an in-flight intersection).
 */
export function InboxInfiniteScrollFooter({
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: InboxInfiniteScrollFooterProps) {
  const t = useTranslations("home.table")
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const onLoadMoreRef = useRef(onLoadMore)
  const canLoadMoreRef = useRef(false)
  onLoadMoreRef.current = onLoadMore
  canLoadMoreRef.current = hasMore && !isLoadingMore && Boolean(onLoadMore)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    if (typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && canLoadMoreRef.current) {
            onLoadMoreRef.current?.()
          }
        }
      },
      { rootMargin: "200px 0px" },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={styles.footer} data-inbox-infinite-footer>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden='true' />
      <output
        className={styles.status}
        aria-label={t("loadingMore")}
        aria-live='polite'
      >
        {isLoadingMore ? (
          <CssSpinner size='sm' dataTestid='inbox-load-more-spinner' />
        ) : null}
      </output>
    </div>
  )
}
