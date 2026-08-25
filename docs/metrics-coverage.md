# MessagingIE Metrics Coverage Map

**Audit date:** 2026-07-16
**Auditor:** Andrea Pregnolato

Emission inventory of MessagingIE features: what signal is tracked, how, and on
which platform. Scope is *emitted* signals only — this map does not assess whether
signals are *observed* (on a dashboard/alert/report). Snapshot of the current
tracking system as of the audit date above; progress against gaps is tracked via
the linked backlog items, not by editing this map.

**Legend** — Platform: Matomo · OTel/Grafana · Faro RUM · DB event_log · none.
Priority (gap rows only): `max(stakeholder visibility, operational importance)`,
H/M/L, assigned in the PM + engineering scoring session. Effort: Trivial · Real work.

## Headline finding

MessagingIE is instrumented across four platforms. **Backend delivery**
(`messaging-api`) emits OTel counters, gauges and a histogram on the
`message_delivery` meter, plus a full `event_log` lifecycle. Both front-ends carry
**Matomo** product-event funnels: the public-servant admin app
(`messaging-admin-next`) covers compose, templates, audit-log and auth; the citizen
app (`citizen-portal`) covers the message read funnel, attachment engagement,
consent decisions, data-export, login and application error. The citizen app also
emits **Faro RUM** diagnostic logs (consent, account-linking, attachment metadata,
auth-session recovery, frontend errors). Notification emails carry **Matomo campaign
attribution**, making email→portal re-engagement measurable.

**Open gaps:** (1) **provider-config changes** — no signal; (2) **attachment
upload/virus-scan backend metrics** — citizen download engagement exists, but no OTel
on upload/scan/download success-vs-failure; (3) the **"journey link" inside a secure
message** — not emitted, architecturally blocked by the sandboxed message-body iframe;
(4) **life-event-journey and outcome/status dimensions** — messaging holds neither, so
per-journey/per-outcome filtering is unmet; (5) **observation** — several emitted
signals still need their Matomo reports / Grafana panels built (see
`docs/observability/usage-dashboards.md`).

## Coverage

| Platform | What's tracked | How it's tracked | Feature area | Owning service | Gap | Priority | Effort | Backlog |
|----------|----------------|------------------|--------------|----------------|-----|----------|--------|---------|
| OTel/Grafana | Messages sent (by org) | Counter `messages_sent`, meter `message_delivery` — `apps/messaging-api/src/utils/metrics.ts:7` | Message composition/sending | govie-services-messaging | — | — | — | — |
| OTel/Grafana | Messages created (by org) | Counter `messages_created` — `apps/messaging-api/src/utils/metrics.ts:25` | Message composition/sending | govie-services-messaging | — | — | — | — |
| OTel/Grafana | Messages read (by org) | Counter `messages_read` `{organizationId}` — `apps/messaging-api/src/utils/metrics.ts:16` | Unified Inbox | govie-services-messaging | — | — | — | — |
| OTel/Grafana | Messages queued (by org) | Gauge + async-gauge `messages_queued` — `apps/messaging-api/src/utils/metrics.ts:33,73` | Batch messaging / delivery queue | govie-services-messaging | — | — | — | — |
| OTel/Grafana | Messages scheduled (by org) | Counter `messages_scheduled` — `metrics.ts:42` (emitted in `messages-processor.ts` scheduleMessage) | Batch messaging / delivery queue | govie-services-messaging | — | — | — | — |
| OTel/Grafana | Message delivery failures (by org, by stage) | Counter `messages_failed{organizationId,stage}`, stage ∈ schedule\|deliver\|email — `metrics.ts:53` (emitted at `job-service.ts` failure sites) | Message events / delivery | govie-services-messaging | Two hard-failure paths (missing provider, secure-message prep) log a success event, so they escape `messages_failed` — see `docs/observability/usage-dashboards.md` §2 | — | — | — |
| OTel/Grafana | Created→delivered duration (by org) | Histogram `message_delivery_duration` (s) — `metrics.ts:63` (recorded in `sendMessageToTransports`) | Message events / delivery | govie-services-messaging | — | — | — | — |
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
| Matomo | Application error (admin) | Event `system-error` | System (public servant) | govie-services-messaging | — | — | — | — |
| Matomo | Message read funnel (list view, open, back) | Events `message-list-view`, `message-detail`, `message-back-click` — `apps/citizen-portal/src/const/analytics.ts:11-13` | Unified Inbox (citizen) | govie-services-messaging | — | — | — | — |
| Matomo | Attachment download + unavailable | Events `message-attachment-download`, `message-attachment-download-error` — `apps/citizen-portal/src/const/analytics.ts:14-21` | Attachment handling (citizen) | govie-services-messaging | — | — | — | — |
| Matomo | Auth (login, once/session) | Event `user-login` — `apps/citizen-portal/src/const/analytics.ts:25`; `components/analytics/login-tracker.tsx` | Onboarding & auth (citizen) | govie-services-messaging | — | — | — | — |
| Matomo | Consent decision + profile change-intent | Events `consent-accepted`, `consent-declined`, `profile-consent-change` — `apps/citizen-portal/src/const/analytics.ts:29-35` | Consent | govie-services-messaging | — | — | — | — |
| Matomo | Data-export request / download | Events `export-requested`, `export-request-error`, `export-downloaded` — `apps/citizen-portal/src/const/analytics.ts:39-47`; `components/lifecycle-tasks` | Data Export (citizen UI) | govie-services-messaging | — | — | — | — |
| Matomo | Application error (citizen) | Event `system-error` — `apps/citizen-portal/src/const/analytics.ts:53`; `app/[locale]/error.tsx` | System (citizen) | govie-services-messaging | — | — | — | — |
| Matomo | Notification email link attribution (click / re-engagement) | Campaign params `mtm_campaign=message-notification&mtm_source=email&mtm_keyword=<orgId>` on `seeMessageUrl` — `apps/messaging-api/src/services/jobs/secure-message-processor.ts:83` | Message notification / re-engagement | govie-services-messaging | Click emitted; engagement *rate* + journey/outcome filters open — see gaps | — | — | — |
| Faro RUM | Consent decision (accepted/declined) + error | `faro.api.pushLog` — `apps/citizen-portal/src/components/client-shell.tsx` | Consent | govie-services-messaging | — | — | — | — |
| Faro RUM | Account-linking confirm via secure message (success/error) | `faro.api.pushLog(TRACE_MESSAGES.CONFIRM_ACCOUNT_LINKING.*)` — `secure-messages/confirm-button.tsx:43,55` | Account linking | govie-services-messaging | — | — | — | — |
| Faro RUM | Attachment metadata missing | `faro.api.pushLog(TRACE_MESSAGES.ATTACHMENT_METADATA.MISSING)` — `messages/attachment-card.tsx` (paired with the Matomo `message-attachment-download-error` event) | Attachment handling | govie-services-messaging | — | — | — | — |
| Faro RUM | Auth-session (stale-claims) recovery lifecycle | `faro.api.pushLog(TRACE_MESSAGES.STALE_CLAIMS_REFRESH.*)` — `client-shell.tsx` | Onboarding & auth (citizen) | govie-services-messaging | — | — | — | — |
| Faro RUM | Frontend errors / chunk-load errors | `faro.api.pushLog` in `app/[locale]/error.tsx` | Cross-cutting | govie-services-messaging | — | — | — | — |
| DB event_log | Message lifecycle events | `MessagingEventType.*` written via `eventLogger.log` to `messaging_event_logs` — createRawMessage(+Error), scheduleMessage(+Error), createTemplateMessage(+Error), deliverMessage/Pending/Error, citizenSeen/UnseenMessage, emailError — `apps/messaging-api/src/services/messages/event-logger.ts:39` | Message events / audit trail; delivery | govie-services-messaging | — | — | — | — |

## Gaps

Priority and Effort are filled in the PM + engineering scoring session.
`max(stakeholder visibility, operational importance)`, H/M/L.

| Platform | What's tracked | How it's tracked | Feature area | Owning service | Gap | Priority | Effort | Backlog |
|----------|----------------|------------------|--------------|----------------|-----|----------|--------|---------|
| Matomo (partial) | Notification email link click | Campaign `mtm_campaign=message-notification` on `seeMessageUrl` (see Coverage) | Message notification / re-engagement | govie-services-messaging | The click is emitted, but the stakeholder-requested *engagement rate* needs a denominator = emails sent (`messages_sent`, OTel/Grafana) — a cross-platform ratio, no single native number. Filter by org ✅; **life-event journey** and **outcome/status** are not carried (see dimension gap below) | Useful (stakeholder-stated) | Real work | — |
| none | Journey link followed from within a secure message | No signal. Message body renders in a **sandboxed iframe** (`SecureEmailViewer`) with `target=_blank` + `Referrer-Policy: no-referrer`, so the parent app's Matomo cannot observe in-body link clicks and the destination gets no referrer; there is no structured "journey link" field | Secure-message → journey/dashboard re-engagement | govie-services-messaging | Stakeholder-requested but not emitted and not trivially coverable. Needs a design decision — (A) server-side tracked redirect at delivery, (B) campaign-tagged journey links + shared Matomo on the destination, or (C) in-iframe click interception via the existing MessageChannel — plus a definition of what a "journey link" is | Useful (stakeholder-stated) | Real work | — |
| none (cross-cutting) | Life-event-journey and outcome/status dimensions | Messaging holds neither: "life event" exists only as a *transport type*, and there is no outcome field on a message | Cross-cutting attribute for email-link + journey-link reporting (and any per-journey reporting) | govie-services-messaging + sending services | To filter usage by life-event journey or application outcome, the sending service must pass those as message metadata and they must be carried into the analytics signal (campaign param or event dimension). Upstream/product change | — | Real work | — |
| DB audit-log (partial, external) | Export lifecycle audit trail; citizen request/download Matomo-emitted (see Coverage) | `auditLogger.safeSendLogs(resource_type: ExportUserData)` — `profile-api/.../export-user-data/index.ts`; frontend events in `citizen-portal` | Data Export | govie-services-messaging (UI) + govie-services-profile (job) | Citizen-side request/download is emitted; no Grafana/Matomo aggregate on export-job volume/success — that lives in the profile repo | — | — | — |
| none (partial) | Send failures only | Config changes emit nothing; send-time `emailError` captured via event_log; org-level `messages_failed` exists but not per-provider | Providers (email/SMS config) | govie-services-messaging | No signal on provider config create/update/delete or per-provider send-provider health (delivery metrics aggregate per org, not per provider — see `docs/adr/0001`) | — | — | — |
| Matomo/OTel (partial) | Citizen + admin download engagement; compose upload step | `message-attachment-download`(+error); `message-step-attachments` (see Coverage) | Attachment handling | govie-services-messaging + upload service | No backend/OTel signal on attachment upload / virus-scan / download success-vs-failure | — | — | — |
