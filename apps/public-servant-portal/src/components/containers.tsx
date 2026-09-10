export const BodyContainer = ({
  children,
  ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLBodyElement>) => {
  return (
    <body
      className='gi-flex gi-flex-col'
      style={{ minHeight: "100vh" }}
      {...props}
    >
      {children}
    </body>
  )
}

export const MainContainer = ({
  children,
  ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <main
      className='gi-flex-1'
      style={{
        marginBottom: "var(--gieds-space-16)",
        marginTop: "var(--gieds-space-10)",
      }}
      {...props}
    >
      {children}
    </main>
  )
}

export const FullWidthContainer = ({
  children,
  ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div style={{ width: "100%" }} {...props}>
      {children}
    </div>
  )
}

export const TwoColumnLayout = ({
  children,
  ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <article className='twelve-column-layout two-columns' {...props}>
      {children}
    </article>
  )
}

export const UserMenuDrawerContainer = ({
  children,
  ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className='user-drawer-menu-container' {...props}>
      {children}
    </div>
  )
}

export const SuccessBannerContainer = ({
  children,
  ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className='success-banner' {...props}>
      {children}
    </div>
  )
}

export const MenuContainer = ({
  children,
  ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className='menu-container' {...props}>
      {children}
    </div>
  )
}
