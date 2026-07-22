# MessagingIE Metrics Coverage Map

**Audit date:** 2026-07-13  ·  **Audited commit:** `6ce8247`  ·  **Auditor:** Andrea Pregnolato

Emission inventory of MessagingIE features: what signal is tracked, how, and on
which platform. Scope is *emitted* signals only — this map does not assess whether
signals are *observed* (on a dashboard/alert/report). Snapshot as of the commit
above; progress against gaps is tracked via the linked backlog items, not by
editing this map.

**Legend** — Platform: Matomo · OTel/Grafana · Faro RUM · DB event_log · none.
Priority (gap rows only): `max(stakeholder visibility, operational importance)`,
H/M/L, assigned in the PM + engineering scoring session. Effort: Trivial · Real work.

## Headline finding

The two sides of the product are instrumented on **different platforms**, not one
covered and one bare. The public-servant admin app (`messaging-admin-next`) carries a
rich **Matomo** event funnel — message composition steps, template lifecycle,
attachment download, audit-log views, auth, dashboard. The citizen-facing apps
(`citizen-portal`, `messaging-next`) emit **no custom Matomo events**, but do emit
**Faro RUM business logs** via `faro.api.pushLog` — consent decisions, secure-message
confirm, attachment errors, and auth-session recovery — beyond page views and error
traces. Backend delivery is covered by four OTel counters/gauges and a full
`event_log` lifecycle.

The real gaps are narrower than first assumed: **provider-config changes** (no
signal), **attachment upload/scan backend metrics** (only client download/upload-step
events exist), and the fact that citizen-side signal is **diagnostic Faro logging, not
aggregate/dashboard-friendly product metrics**. Templates and Attachments are NOT
gaps (admin-side Matomo). Consent is NOT unmeasured — it emits Faro decision/error
logs, though no Matomo/OTel aggregate. Data Export (external, profile repo) emits an
audit-log trail, not a Grafana/Matomo signal.

## Coverage

| Platform | What's tracked | How it's tracked | Feature area | Owning service | Gap | Priority | Effort | Backlog |
|----------|----------------|------------------|--------------|----------------|-----|----------|--------|---------|
| OTel/Grafana | Messages sent (by org) | Counter `messages_sent`, meter `message_delivery` — `apps/messaging-api/src/utils/metrics.ts:7` | Message composition/sending | govie-services-messaging | — | — | — | — |
| OTel/Grafana | Messages created (by org) | Counter `messages_created` — `apps/messaging-api/src/utils/metrics.ts:22` | Message composition/sending | govie-services-messaging | — | — | — | — |
| OTel/Grafana | Messages read | Counter `messages_read` — `apps/messaging-api/src/utils/metrics.ts:16` | Unified Inbox | govie-services-messaging | — | — | — | — |
| OTel/Grafana | Messages queued (by org) | Gauge + async-gauge `messages_queued` — `apps/messaging-api/src/utils/metrics.ts:30,41` | Batch messaging / delivery queue | govie-services-messaging | — | — | — | — |
| Matomo | Profile list viewed / searched | Events `support-list-view`, `support-list-search` — `apps/messaging-support/const/analytics.ts` | Super User Console | govie-services-messaging | — | — | — | — |
| Matomo | Profile details viewed | Event `support-profile-view` | Super User Console | govie-services-messaging | — | — | — | — |
| Matomo | Profile linked / unlinked | Events `support-profile-linked`, `support-profile-unlinked` | Account linking | govie-services-messaging | — | — | — | — |
| Matomo | Profile deleted | Event `support-profile-deleted` — `DeleteAccountSection.tsx:38` | Account Deletion | govie-services-messaging | — | — | — | — |
| Matomo | Message compose funnel (type→recipients→attachments→schedule→complete) | Events `message-step-*` — `apps/messaging-admin-next/src/const/analytics.ts:92-109` | Message composition/sending (public servant) | govie-services-messaging | — | — | — | — |
| Matomo | Message reading (open, time-on-message, list, back) | Events `message-detail`, `message-session-start`, `message-list-view`, `message-back-click` | Message reading (public servant) | govie-services-messaging | — | — | — | — |
| Matomo | Attachment downloaded / uploaded (compose step) | Events `message-attachment-download`, `message-step-attachments` | Attachment handling (public servant) | govie-services-messaging | — | — | — | — |
| Matomo | Template create / edit / preview / delete | Events `template-*` — `apps/messaging-admin-next/src/const/analytics.ts:113-128` | Templates | govie-services-messaging | — | — | — | — |
| Matomo | Audit log viewed (all / detail) | Events `event-logs-all`, `event-logs-detail` | Message events / audit trail (public servant) | govie-services-messaging | — | — | — | — |
| Matomo | Admin auth + onboarding + dashboard | Events `user-login/logout`, `login/logout`, `dashboard-view`, onboarding | Onboarding & auth (public servant) | govie-services-messaging | — | — | — | — |
| Matomo | Footer link engagement | Event `footer-link-click` | Engagement (public servant) | govie-services-messaging | — | — | — | — |
| Matomo | Application error | Event `system-error` | System (public servant) | govie-services-messaging | — | — | — | — |
| Faro RUM | Consent decision (accepted/declined) + error | `faro.api.pushLog` — `citizen-portal/.../client-shell.tsx:352,364`; same in `messaging-next` | Consent | govie-services-messaging | — | — | — | — |
| Faro RUM | Account-linking confirm via secure message (success/error) | `faro.api.pushLog(TRACE_MESSAGES.CONFIRM_ACCOUNT_LINKING.*)` — `secure-messages/confirm-button.tsx:43,55` (both citizen apps) | Account linking | govie-services-messaging | — | — | — | — |
| Faro RUM | Attachment metadata missing | `faro.api.pushLog(TRACE_MESSAGES.ATTACHMENT_METADATA.MISSING)` — `messages/attachment-card.tsx:78` (both citizen apps) | Attachment handling | govie-services-messaging | — | — | — | — |
| Faro RUM | Auth-session (stale-claims) recovery lifecycle | `faro.api.pushLog(TRACE_MESSAGES.STALE_CLAIMS_REFRESH.*)` — `client-shell.tsx:203-251` (both citizen apps) | Onboarding & auth (citizen) | govie-services-messaging | — | — | — | — |
| Faro RUM | Frontend errors / chunk-load errors | `faro.api.pushLog` in `app/[locale]/error.tsx` (all three next apps) | Cross-cutting | govie-services-messaging | — | — | — | — |
| DB event_log | Message lifecycle events | `MessagingEventType.*` written via `eventLogger.log` to `messaging_event_logs` — createRawMessage(+Error), scheduleMessage(+Error), createTemplateMessage(+Error), deliverMessage/Pending/Error, citizenSeen/UnseenMessage, emailError — `apps/messaging-api/src/services/messages/event-logger.ts:39` | Message events / audit trail; delivery | govie-services-messaging | — | — | — | — |

## Gaps

Priority and Effort are filled in the PM + engineering scoring session (see below).
`max(stakeholder visibility, operational importance)`, H/M/L.

| Platform | What's tracked | How it's tracked | Feature area | Owning service | Gap | Priority | Effort | Backlog |
|----------|----------------|------------------|--------------|----------------|-----|----------|--------|---------|
| Faro (partial) | Consent decision + error logged | `faro.api.pushLog` in citizen client-shell (see Coverage) | Consent | govie-services-messaging | Faro logs exist but are diagnostic, not an aggregate/dashboard KPI — no Matomo event or OTel metric on consent grant/withdraw or banner acceptance rate | — | — | — |
| DB audit-log (partial, external) | Export lifecycle audit trail | `auditLogger.safeSendLogs(resource_type: ExportUserData)` — `profile-api/.../export-user-data/index.ts` (~10 calls) | Data Export | govie-services-profile (external) | An audit-log trail exists (comparable to messaging `event_log`), but no Grafana/Matomo signal on export request volume/success; deeper profile-repo audit is its own scope | — | — | — |
| none (partial) | Send failures only | Config changes emit nothing; send-time `emailError` captured via event_log | Providers (email/SMS config) | govie-services-messaging | No signal on provider config create/update/delete or per-provider send-provider health | — | — | — |
| Matomo (partial) | Admin download + compose upload step | `message-attachment-download`, `message-step-attachments`; citizen side has Faro logs only | Attachment handling | govie-services-messaging + upload service | No backend/OTel signal on attachment upload / virus-scan / download success vs failure; no citizen-side engagement event | — | — | — |
| Matomo (partial) | Page views + Faro only | No custom events on citizen apps; backend `messages_read` (OTel) exists | Unified Inbox (citizen) | govie-services-messaging | No citizen-side custom events for message open/read/interaction — the citizen surface is page-views-only while the public-servant surface has a full funnel | — | — | — |
