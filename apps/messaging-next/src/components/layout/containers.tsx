import type { ReactNode } from "react"

export function MainContainer({ children }: { children: ReactNode }) {
  return (
    <main
      className='gi-flex-1'
      style={{
        marginBottom: "var(--gieds-space-16)",
        marginTop: "var(--gieds-space-10)",
      }}
    >
      {children}
    </main>
  )
}
