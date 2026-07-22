#!/usr/bin/env bash
# Metrics coverage audit — emission discovery.
# Enumerates emitted signals (OTel / Matomo / Faro / event_log) across the repo.
# Output is pasted verbatim into docs/metrics-coverage.md as the evidence appendix.
# Re-run any time to refresh the snapshot. ponytail: grep-based inventory, not a
# semantic analyser — it lists call sites, a human confirms meaning.
set -euo pipefail
cd "$(dirname "$0")/.."

section() { printf '\n=== %s ===\n' "$1"; }

report() {
  section "OTel metrics (getMetric calls)"
  rg -n --no-heading 'getMetric<' apps -g '*.ts' -g '!*test*' -A3 || true

  section "OTel metric names + meters"
  rg -n --no-heading 'metricName:|meterName:' apps -g '*.ts' -g '!*test*' || true

  section "Matomo analytics event constants (ANALYTICS.* definitions)"
  rg -n --no-heading -l 'export const ANALYTICS' apps || true
  rg -n --no-heading '(name|action|category):' apps -g '**/const/analytics.ts' || true

  section "Matomo custom-event call sites (trackEvent / analyticsEvent)"
  rg -n --no-heading 'trackEvent|analyticsEvent|pushEvent|handle.*EventTracking' apps -g '*.tsx' -g '*.ts' -g '!*test*' || true

  section "Faro RUM init/presence"
  rg -n --no-heading 'faro-web-sdk|initializeFaro|@grafana/faro' apps -g '*.ts' -g '*.tsx' -g '!*test*' || true

  section "Faro RUM business-event call sites (faro.api.push*)"
  # \S* matches optional chaining (faro.api?.pushLog) — import-only detection
  # missed these (consent decisions, read-confirm, attachment errors, auth session).
  rg -n --no-heading 'faro\S*\.push\w*' apps -g '*.ts' -g '*.tsx' -g '!*test*' || true

  section "DB event_log event types"
  rg -n --no-heading 'event_log|eventType|EventType' apps/messaging-api/src -g '*.ts' -g '!*test*' || true
}

if [[ "${1:-}" == "--self-check" ]]; then
  out="$(report)"
  fail=0
  for needle in "messagesReadCounter" "messages_sent" "support-profile-deleted" "handleDeleteEventTracking" "faro-web-sdk" "pushLog" "citizenSeenMessage"; do
    if ! grep -qi "$needle" <<<"$out"; then
      echo "SELF-CHECK FAIL: expected to find '$needle' in discovery output" >&2
      fail=1
    fi
  done
  [[ $fail -eq 0 ]] && echo "SELF-CHECK PASS: all known signals discovered"
  exit $fail
fi

report
