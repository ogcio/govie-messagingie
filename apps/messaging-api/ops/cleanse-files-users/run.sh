#!/usr/bin/env bash
# =============================================================================
# run.sh - thin ordered driver for the files_users cleanse.
#
# SAFE BY DEFAULT: runs 01 (messaging) -> 02 (stage) -> loads the CSV -> 03
# (dry-run report) and STOPS. Pass --delete to additionally run 04 (chunked
# delete) -> 05 (validate). It never runs 04 without --delete, and never rolls
# back (use 99 manually).
#
# USER-SCOPED DELETE: the delete (04) is driven per user batch. Provide the
# batch with --users '{id1,id2,...}' (inline varchar[] literal) or --users-file
# PATH (a file of newline- or comma-separated user_ids; --users wins if both
# are given). The dry-run report (03) and validate (05) accept the same batch
# but may also run full-scope (empty USERS). --delete REQUIRES a non-empty
# USERS batch; an empty batch is rejected so it can never delete "all".
#
# EXTERNAL_ID SCOPE (prod-only): by default the cleanse only touches migrated
# files (files.external_id IS NOT NULL). dev/uat never ran the digital-postbox
# migration so external_id is always NULL there — pass --no-external-id-filter
# to drop that predicate and rehearse against org + candidate scoping alone.
# PROD keeps the filter ON (do NOT pass the flag there).
#
# GROUPED DELETE: --group N (N>0, requires --delete) processes the resolved USER
# batch in successive N-user windows instead of one 04 call — keeps each
# `user_id = ANY(array)` small and gives each window its own transaction/backup.
# 01/02/CSV-load and the 03 dry-run run ONCE for the full batch; then 04 loops
# per window with RUN_ID="<run-id>-gNNNN"; then 05 runs ONCE for the full batch.
# --group 0 (default) disables grouping (single 04 call — behaviour unchanged).
#
# CSV I/O is driven from the shell on purpose: psql's `\copy` does NOT
# interpolate variables, so this script controls every CSV path:
#   * the extract (01) streams `COPY (...) TO STDOUT` and is redirected here;
#   * the load (02) and the optional report export (03) use `psql -c "\copy ..."`
#     with the path substituted by the shell.
#
# Requires env (one host/pod that can reach both RDS instances):
#   MESSAGING_DSN (messaging DB), UPLOAD_DSN (upload DB).
# These are SEPARATE Postgres databases, so no cross-DB JOIN is possible: the
# legit pairs are extracted to CSV and loaded into upload-DB staging.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ORG="" RUN_ID="" CHUNK="5000"
CSV="${CSV_PATH:-/tmp/cleanse_legit_file_user.csv}"
REPORT_CSV="${REPORT_CSV:-}"
# Repro-leak exclusion list (dev fileB + uat fileB). Keep in sync with the
# EXCLUDE_FILE_IDS default in 03/04/05; passed through so the report export and
# the dry-run/delete steps all use the same set.
EXCLUDE="${EXCLUDE_FILE_IDS:-{c295d8e1-8501-4724-83cc-ac7fe56961aa,ee1dc5f4-0bfd-40b7-950f-10b1723923d4}}"
# User batch (varchar[] literal). Empty {} = all users (full-scope report/validate).
# --delete requires this to be non-empty. --users overrides --users-file.
USERS="{}"
USERS_FILE=""
# external_id scope guard. true (default) = prod behaviour (migrated files only);
# --no-external-id-filter sets false for dev/uat rehearsal where external_id is NULL.
REQUIRE_EXTERNAL_ID="true"
# Grouped delete window size. 0 = disabled (single 04 call). >0 requires --delete.
GROUP="0"
DO_DELETE="no"

usage() {
  echo "Usage: MESSAGING_DSN=... UPLOAD_DSN=... $0 --org ORG --run-id RUN_ID [--chunk N] [--csv PATH] [--report-csv PATH] [--exclude '{uuid,...}'] [--users '{id1,id2,...}'] [--users-file PATH] [--no-external-id-filter] [--group N] [--delete]" >&2
  echo "  --users / --users-file: user_id batch for the delete. --delete REQUIRES a non-empty batch; dry-run may omit it (full scope)." >&2
  echo "  --no-external-id-filter: drop the prod-only external_id predicate (use in dev/uat, where the migration never ran)." >&2
  echo "  --group N: process the delete batch in N-user windows (each its own <run-id>-gNNNN backup). 0=disabled (default). Needs --delete." >&2
  exit 2
}

# Build a varchar[] literal '{a,b,c}' from a file of newline- or comma-separated
# ids, stripping whitespace and blank lines.
build_users_from_file() {
  local f="$1" ids
  # split on commas -> one id per line; strip whitespace WITHIN each line (keep
  # line boundaries); drop blank lines; rejoin with commas.
  ids=$(tr ',' '\n' < "$f" | sed 's/[[:space:]]//g' | grep -v '^$' | paste -sd, -)
  printf '{%s}' "$ids"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --org)        ORG="$2"; shift 2 ;;
    --run-id)     RUN_ID="$2"; shift 2 ;;
    --chunk)      CHUNK="$2"; shift 2 ;;
    --csv)        CSV="$2"; shift 2 ;;
    --report-csv) REPORT_CSV="$2"; shift 2 ;;
    --exclude)    EXCLUDE="$2"; shift 2 ;;
    --users)      USERS="$2"; shift 2 ;;
    --users-file) USERS_FILE="$2"; shift 2 ;;
    --no-external-id-filter) REQUIRE_EXTERNAL_ID="false"; shift ;;
    --group)      GROUP="$2"; shift 2 ;;
    --delete)     DO_DELETE="yes"; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

: "${MESSAGING_DSN:?set MESSAGING_DSN to the messaging DB connection string}"
: "${UPLOAD_DSN:?set UPLOAD_DSN to the upload DB connection string}"
[[ -n "$ORG" && -n "$RUN_ID" ]] || usage

# Resolve the user batch: --users wins; else --users-file; else empty {}.
if [[ "$USERS" == "{}" && -n "$USERS_FILE" ]]; then
  [[ -f "$USERS_FILE" ]] || { echo "ERROR: --users-file not found: $USERS_FILE" >&2; exit 2; }
  USERS="$(build_users_from_file "$USERS_FILE")"
fi

# The delete step is user-scoped: it must never run against "all".
if [[ "$DO_DELETE" == "yes" && ( -z "$USERS" || "$USERS" == "{}" ) ]]; then
  echo "ERROR: --delete requires a non-empty --users/--users-file batch (got empty {})." >&2
  echo "       Dry-run (no --delete) may run full-scope with an empty batch." >&2
  exit 2
fi

# --group must be a non-negative integer. >0 only affects the delete loop; with
# no --delete it is a no-op (03 still runs full-scope for the whole batch).
[[ "$GROUP" =~ ^[0-9]+$ ]] || { echo "ERROR: --group must be a non-negative integer (got '$GROUP')." >&2; exit 2; }

# ---- 01: stream legit pairs from messaging to the CSV (stdout redirect) ------
echo ">> [01] extract legit pairs (messaging DB) -> $CSV"
psql "$MESSAGING_DSN" -X -q -f "$HERE/01_messaging_extract_legit_pairs.sql" > "$CSV"

# ---- 02: create (empty) staging + backup + helper function ------------------
echo ">> [02] create staging + backup objects (upload DB)"
psql "$UPLOAD_DSN" -v ON_ERROR_STOP=1 -f "$HERE/02_upload_stage_and_backup.sql"

# ---- load the CSV into staging (shell drives the \copy path) ----------------
echo ">> [02] load legit pairs   -> cleanse_legit_file_user  ($CSV)"
psql "$UPLOAD_DSN" -v ON_ERROR_STOP=1 \
  -c "\copy cleanse_legit_file_user (file_id, user_id) FROM '$CSV' WITH (FORMAT csv, HEADER true)"

# ---- 03: dry-run report -----------------------------------------------------
echo ">> [03] DRY RUN report (upload DB) - review this  (users=$USERS, require_external_id=$REQUIRE_EXTERNAL_ID)"
psql "$UPLOAD_DSN" -v MIGRATED_ORG="$ORG" -v EXCLUDE_FILE_IDS="$EXCLUDE" -v USER_IDS="$USERS" -v REQUIRE_EXTERNAL_ID="$REQUIRE_EXTERNAL_ID" \
  -f "$HERE/03_upload_dry_run_report.sql"

# ---- optional: export the COMPLETE bad-pair list to CSV (shell-driven \copy) -
if [[ -n "$REPORT_CSV" ]]; then
  echo ">> [03] export full bad-pair list -> $REPORT_CSV  (users=$USERS, require_external_id=$REQUIRE_EXTERNAL_ID)"
  psql "$UPLOAD_DSN" -v ON_ERROR_STOP=1 \
    -c "\copy (SELECT file_id, user_id, shared_at FROM cleanse_bad_rows('$ORG', '$EXCLUDE'::uuid[], '$USERS'::varchar[], '$REQUIRE_EXTERNAL_ID'::boolean) ORDER BY file_id, user_id) TO '$REPORT_CSV' WITH (FORMAT csv, HEADER true)"
fi

if [[ "$DO_DELETE" != "yes" ]]; then
  echo ">> stopping after dry run (pass --delete to run 04+05). Nothing deleted."
  exit 0
fi

if [[ "$GROUP" -gt 0 ]]; then
  # Grouped delete: split the resolved {a,b,...} batch into GROUP-sized windows,
  # one 04 call per window, each with its own <run-id>-gNNNN backup/rollback key.
  inner="${USERS#\{}"; inner="${inner%\}}"      # strip the surrounding braces
  IFS=',' read -r -a _uarr <<< "$inner"
  total=${#_uarr[@]}
  echo ">> [04] GROUPED DELETE: $total user(s) in windows of $GROUP (base run_id=$RUN_ID)"
  win=0
  for ((i=0; i<total; i+=GROUP)); do
    window=("${_uarr[@]:i:GROUP}")
    win_users="{$(IFS=,; echo "${window[*]}")}"
    win_run_id="${RUN_ID}-g$(printf '%04d' "$win")"
    echo ">> [04] window $win size=${#window[@]} run_id=$win_run_id users=$win_users"
    psql "$UPLOAD_DSN" -v MIGRATED_ORG="$ORG" -v EXCLUDE_FILE_IDS="$EXCLUDE" \
      -v RUN_ID="$win_run_id" -v CHUNK="$CHUNK" -v USER_IDS="$win_users" -v REQUIRE_EXTERNAL_ID="$REQUIRE_EXTERNAL_ID" \
      -f "$HERE/04_upload_cleanse_chunked.sql"
    win=$((win + 1))
  done
  echo ">> [04] grouped delete done: $win window(s). Rollback a window with its own -gNNNN run-id."
else
  echo ">> [04] CHUNKED DELETE (upload DB) run_id=$RUN_ID chunk=$CHUNK users=$USERS require_external_id=$REQUIRE_EXTERNAL_ID"
  psql "$UPLOAD_DSN" -v MIGRATED_ORG="$ORG" -v EXCLUDE_FILE_IDS="$EXCLUDE" \
    -v RUN_ID="$RUN_ID" -v CHUNK="$CHUNK" -v USER_IDS="$USERS" -v REQUIRE_EXTERNAL_ID="$REQUIRE_EXTERNAL_ID" \
    -f "$HERE/04_upload_cleanse_chunked.sql"
fi

echo ">> [05] validate (upload DB) users=$USERS require_external_id=$REQUIRE_EXTERNAL_ID"
psql "$UPLOAD_DSN" -v MIGRATED_ORG="$ORG" -v EXCLUDE_FILE_IDS="$EXCLUDE" -v RUN_ID="$RUN_ID" -v USER_IDS="$USERS" -v REQUIRE_EXTERNAL_ID="$REQUIRE_EXTERNAL_ID" \
  -f "$HERE/05_upload_validate.sql"

if [[ "$GROUP" -gt 0 ]]; then
  echo ">> done. Rollback a window: psql \"\$UPLOAD_DSN\" -v RUN_ID=$RUN_ID-gNNNN -f $HERE/99_upload_rollback.sql (NNNN = 0000,0001,...)"
else
  echo ">> done. Rollback if needed: psql \"\$UPLOAD_DSN\" -v RUN_ID=$RUN_ID -f $HERE/99_upload_rollback.sql"
fi
