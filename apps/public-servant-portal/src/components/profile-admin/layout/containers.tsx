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

export function TwoColumnLayout({ children }: { children: ReactNode }) {
  return (
    <article className='twelve-column-layout two-columns'>{children}</article>
  )
}

export function FullWidthContainer({ children }: { children: ReactNode }) {
  return <div style={{ width: "100%" }}>{children}</div>
}
