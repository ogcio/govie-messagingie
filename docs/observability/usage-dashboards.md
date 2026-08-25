# Usage Dashboards and Matomo Reports

This document specifies the observation artifacts for the messaging platform instrumentation initiative. Each artifact below is the acceptance criterion of its corresponding emission backlog item (see `CONTEXT.md` "Observation pairing").

## Grafana: Message Delivery Dashboard

**Target repository:** observability (dashboard-as-code)

The "Message delivery" dashboard visualizes message lifecycle metrics per organization, enabling operators to monitor stage progression, failure rates, and delivery performance.

### Panels

#### 1. Stage Funnel
**Title:** Message Delivery Funnel (Rate & Cumulative)

Display rate and cumulative counts for the message delivery stages, segmented by organization (via `organizationId` variable):
- `messages_created` — messages entered into the system
- `messages_scheduled` — messages scheduled for delivery
- `messages_sent` — messages successfully dispatched
- `messages_read` — messages opened by recipients

**Visualization:** Stat panel with rate (5-minute increment) and cumulative (total), filterable by `organizationId`.

**Note:** Only `messages_sent` has historical backfill — the pre-existing `metrics-backfill` job reconstructs it from `messaging_event_logs`. The other funnel stages (`messages_created`, `messages_scheduled`, `messages_read`) are **not** backfilled; their series begin at ship date, so expect flat/empty history before deployment for those stages.

#### 2. Failure Rate by Stage
**Title:** Message Failures by Delivery Stage

Display `messages_failed` counter segmented by stage (`schedule`, `deliver`, `email`), per organization. This shows where messages are dropping out of the pipeline.

**Visualization:** Bar chart or timeseries, grouped by `stage` and filterable by `organizationId`.

**Known gap (do not read a zero as "healthy"):** two hard delivery-failure modes are **not** captured by `messages_failed` — a missing/misconfigured email provider for the org, and a secure-message preparation error (`job-service.ts` `sendMessageToTransports`). These paths mark the job failed but log a `message_delivery`/`successful` event (pre-existing event-type labeling, out of scope for the instrumentation initiative), so they neither increment `messages_failed` nor `messages_sent` live — but the `messages_sent` **backfill** does count them, so historical `messages_sent` for an org with a period of provider misconfiguration is slightly overstated. Treat the `deliver` stage as a floor, not a complete count, until the underlying event labeling is corrected.

#### 3. Delivery Duration
**Title:** Message Delivery Duration (p50/p95)

Display percentile latencies from message creation to successful delivery, computed from the `message_delivery_duration` histogram (in seconds):
- p50 (median) — using `histogram_quantile(0.50, ...)`
- p95 (95th percentile) — using `histogram_quantile(0.95, ...)`

Segmented by organization (`organizationId`).

**Visualization:** Timeseries panel with two series (p50 and p95 overlaid).

**Note:** The `message_delivery_duration` histogram has no pre-ship history. Like the other new metrics, it is not backfilled — the series starts at deployment and accumulates only from live traffic thereafter.

#### 4. Queue Depth
**Title:** Messages in Queue

Display the `messages_queued` gauge (a running count of messages currently pending processing), segmented by organization (`organizationId`).

**Visualization:** Graph or gauge panel.

### Dashboard Variables
- `organizationId`: Template variable for filtering metrics by organization ID.

---

## Matomo: Citizen Journey Funnel Report

**Target:** Matomo UI (citizen-portal website)

The citizen journey funnel tracks how email-referred users progress through the messaging portal, from initial email-click to message consumption. It also surfaces consent and error behaviors.

### Funnel Steps
1. **Campaign Visit** — Visitor lands on portal via email link with `mtm_campaign=message-notification` and `mtm_source=email`
2. **Login** — Event: `user-login`
3. **Message List View** — Event: `message-list-view`
4. **Message Detail** — Event: `message-detail`
5. **Attachment Download** — Event: `message-attachment-download`

### Segments
Apply the following segments within the funnel to understand conversion barriers and engagement:

#### Consent Decision Rate
- **Segment:** Consent-accepted vs. consent-declined
  - `consent-accepted` — proportion of users who accepted consent during onboarding
  - `consent-declined` — proportion of users who declined consent

#### Error Incidents
- **Segment:** `system-error` events alongside funnel steps
  - Identifies funnels impacted by application errors

#### Per-Organization Email Conversion
- **Dimension:** `mtm_keyword` (carries the sender `organisationId` from email campaign params — British spelling in the email code, distinct from the OTel `organizationId` tag)
  - Allows ranking organizations by email-to-portal conversion rates

---

## Matomo: Engagement Report

**Target:** Matomo UI (citizen-portal website)

The engagement report measures visitor and user behavior across the portal, including geography, device, and cross-zone navigation.

### Metrics
- **Visits** — Total portal visits
- **Unique Visitors** — Count of distinct visitors
- **New vs. Returning** — Breakdown of new-visitor percentage vs. returning-visitor percentage
  - **Device-level caveat:** User ID (cross-device tracking) is intentionally parked; repeat-visitor classification is device-scoped, not user-scoped

### Users Flow
Display visitor flow across zones (messaging, profile, dashboard hostnames):
- **Incoming zone paths** — where users enter
- **Cross-zone transitions** — movement between messaging, profile, and dashboard sections
- **Drop-off points** — where sessions end

### Standalone Deployment Verification Checklist
- [ ] Verify that all standalone deployments (see `docs/feature-flags.md` for deployment modes) report metrics to the same Matomo website ID
  - This ensures unified reporting across isolated instances

---

## Pairing Rule: Observation Artifacts and Backlog Items

Each observation artifact defined above corresponds to an emission backlog item in the instrumentation initiative:

1. **Grafana dashboard-as-code** → Acceptance criterion: "Message delivery" dashboard deployed to observability repo with all four panels (funnel, failures, duration, queue) and `organizationId` filtering
2. **Matomo citizen journey funnel** → Acceptance criterion: Funnel report configured in Matomo UI for citizen-portal, capturing funnel steps, consent/error segments, and per-org email conversion
3. **Matomo engagement report** → Acceptance criterion: Engagement report configured in Matomo UI with visits, new/returning breakdown, Users Flow, and standalone verification checklist completed

See `CONTEXT.md` ("Observation pairing") for the full integration pattern.
