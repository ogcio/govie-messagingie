import type { ReactNode } from "react"
import styles from "./main-container.module.css"

export function MainContainer({ children }: { children: ReactNode }) {
  return <main className={`gi-flex-1 ${styles.mainContainer}`}>{children}</main>
}
