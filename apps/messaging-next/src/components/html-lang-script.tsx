/**
 * Injects a synchronous script that sets document.documentElement.lang
 * before first paint. Must be used with suppressHydrationWarning on <html>.
 *
 * This is the same pattern used by next-themes for <html> attribute injection.
 */
export function HtmlLangScript({ locale }: { locale: string }) {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: safe, locale is from generateStaticParams
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.lang="${locale}"`,
      }}
    />
  )
}
