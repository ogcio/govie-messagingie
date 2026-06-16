import { OnboardingShell } from "@/components/onboarding-shell"
import { OnboardingIntlProvider } from "./onboarding-intl-provider"
import "@/app/[locale]/styles.css"

/**
 * `/onboarding` is intentionally outside the `[locale]/` tree — it's the
 * post-MyGovID handoff page. There is no URL locale segment, so the language
 * is driven client-side from a `?lng=` query param (set by the header language
 * toggle), falling back to the routing default. The layout reuses the
 * locale-scoped stylesheet so chrome looks consistent.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <OnboardingIntlProvider>
      <OnboardingShell>{children}</OnboardingShell>
    </OnboardingIntlProvider>
  )
}
