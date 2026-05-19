/**
 * Organisation ids that the messaging-api stamps onto messages it generates
 * itself (data-export-ready notifications, account lifecycle messages, etc.)
 * rather than messages forwarded on behalf of a real public-sector body.
 *
 * The current source of these is the messaging-api `SUPPORT_ORGANISATION_ID`
 * env var (see `apps/messaging-api/src/plugins/external/env.ts`), which
 * defaults to the literal slug `"support"`. Because that value is *not* a
 * UUID and there is no matching record in the profile service, the per-row
 * `<SenderName>` lookup against `/profile/api/v1/organisations/{id}` returns
 * `403 Forbidden` and falls through to the localized "Unknown sender" label.
 *
 * Map known system slugs to a translation key under `home.table.systemSender`
 * so the inbox can short-circuit the profile lookup *and* render a
 * meaningful, localized label (e.g. "MessagingIE") for these rows. The map
 * is intentionally tiny — anything not in here continues to flow through the
 * normal profile-API resolution path used for real organisations.
 *
 * Keep this in sync with the messaging-api `SUPPORT_ORGANISATION_ID` value
 * (and any siblings introduced for other internal services). When a slug is
 * added here, also add a label under `home.table.systemSender.<key>` in
 * `src/messages/en.json` and `src/messages/ga.json`.
 */
export const SYSTEM_SENDER_LABELS: Readonly<Record<string, string>> = {
  support: "support",
}

/**
 * Returns the localized translation key for a known system sender, or `null`
 * when the id is either falsy or refers to a real organisation that should
 * be resolved via the profile service in the usual way.
 *
 * Centralised here (rather than inlined into `<SenderName>`) so future
 * consumers — bulk-action toolbars, message-detail headers, notification
 * digests — share the same slug recognition without each rebuilding the
 * map.
 */
export function getSystemSenderTranslationKey(
  organisationId: string | null | undefined,
): string | null {
  if (!organisationId) return null
  return SYSTEM_SENDER_LABELS[organisationId] ?? null
}
