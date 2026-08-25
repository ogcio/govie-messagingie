#!/usr/bin/env bash
# =============================================================================
# make-batches.sh - freeze the affected-user population and slice it into the
# THREE files used by the 3-step user-scoped cleanse (04).
#
# From the full-scope dry-run report (run.sh --report-csv) OR a ready master
# list, it produces (into --out):
#   * all_affected.txt  - the frozen master list (sorted, unique)
#   * verify_<first>.txt  - first  --first users  (verification cohort, default 4)
#   * verify_<second>.txt - next   --second users (verification cohort, default 14)
#   * remaining.txt      - ALL the rest (deleted in groups of 20 via run.sh --group 20)
#
# The 3-step flow those files drive:
#   1) delete verify_<first>.txt  -> manually trigger an export and verify no leak
#   2) delete verify_<second>.txt -> manually verify again
#   3) delete remaining.txt with `run.sh --group 20` (grouped internally; one cmd)
#
# You MAY hand-edit verify_<first>.txt / verify_<second>.txt to pick specific
# known-leak users instead of the first-N slice — the counts/names are just the
# default cohort sizes.
#
# >>> PII WARNING: all_affected/verify_*/remaining files contain profile ids.
# >>> They are written to --out at runtime and MUST NOT be committed to git.
# >>> This script writes ONLY inside --out; it never touches anything else.
#
# USAGE:
#   make-batches.sh (--report-csv PATH | --users-file PATH) \
#       [--exclude-file PATH]... [--first N] [--second N] [--out DIR]
#
# EXAMPLE (freeze from the report, default 4/14 cohorts):
#   ./make-batches.sh --report-csv /tmp/bad_pairs.csv --out ./batches
# =============================================================================
set -euo pipefail

REPORT_CSV=""
USERS_FILE=""
EXCLUDE_FILES=()
FIRST=4
SECOND=14
OUT="./batches"

usage() {
  echo "Usage: $0 (--report-csv PATH | --users-file PATH) [--exclude-file PATH]... [--first N] [--second N] [--out DIR]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --report-csv)   REPORT_CSV="$2"; shift 2 ;;
    --users-file)   USERS_FILE="$2"; shift 2 ;;
    --exclude-file) EXCLUDE_FILES+=("$2"); shift 2 ;;
    --first)        FIRST="$2"; shift 2 ;;
    --second)       SECOND="$2"; shift 2 ;;
    --out)          OUT="$2"; shift 2 ;;
    -h|--help)      usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

# ---- guards -----------------------------------------------------------------
if [[ -n "$REPORT_CSV" && -n "$USERS_FILE" ]]; then
  echo "ERROR: pass exactly ONE of --report-csv / --users-file (got both)." >&2
  exit 2
fi
if [[ -z "$REPORT_CSV" && -z "$USERS_FILE" ]]; then
  echo "ERROR: one of --report-csv / --users-file is required." >&2
  exit 2
fi
SRC="${REPORT_CSV:-$USERS_FILE}"
[[ -f "$SRC" ]] || { echo "ERROR: source file not found: $SRC" >&2; exit 2; }
[[ "$FIRST"  =~ ^[0-9]+$ ]] || { echo "ERROR: --first must be a non-negative integer (got '$FIRST')." >&2; exit 2; }
[[ "$SECOND" =~ ^[0-9]+$ ]] || { echo "ERROR: --second must be a non-negative integer (got '$SECOND')." >&2; exit 2; }
for ef in "${EXCLUDE_FILES[@]}"; do
  [[ -f "$ef" ]] || { echo "ERROR: --exclude-file not found: $ef" >&2; exit 2; }
done

mkdir -p "$OUT"

# Normalize a user-id list (newline- or comma-separated) the same way run.sh's
# build_users_from_file does: split commas -> lines, strip whitespace within
# each line, drop blanks. (No sort here; caller sorts.)
normalize() { tr ',' '\n' | sed 's/[[:space:]]//g' | grep -v '^$' || true; }

MASTER="$OUT/all_affected.txt"
REMAINING="$OUT/remaining.txt"
VERIFY1="$OUT/verify_$(printf '%02d' "$FIRST").txt"
VERIFY2="$OUT/verify_$(printf '%02d' "$SECOND").txt"

# ---- 1) build the frozen master list ---------------------------------------
if [[ -n "$REPORT_CSV" ]]; then
  # CSV header is file_id,user_id,shared_at -> take column 2, skip header.
  tail -n +2 "$REPORT_CSV" | cut -d, -f2 | normalize | sort -u > "$MASTER"
else
  normalize < "$USERS_FILE" | sort -u > "$MASTER"
fi

# ---- 2) subtract excluded cohorts (resumes) ---------------------------------
POOL="$OUT/.pool.tmp"          # master minus excludes, still sorted
EXCLUDED_COUNT=0
if [[ ${#EXCLUDE_FILES[@]} -gt 0 ]]; then
  EXCL="$OUT/.excluded.tmp"
  : > "$EXCL"
  for ef in "${EXCLUDE_FILES[@]}"; do
    normalize < "$ef" >> "$EXCL"
  done
  sort -u "$EXCL" -o "$EXCL"
  EXCLUDED_COUNT=$(wc -l < "$EXCL" | tr -d '[:space:]')
  comm -23 "$MASTER" "$EXCL" > "$POOL"   # both sides sorted
  rm -f "$EXCL"
else
  cp "$MASTER" "$POOL"
fi

MASTER_COUNT=$(wc -l < "$MASTER" | tr -d '[:space:]')
POOL_COUNT=$(wc -l < "$POOL" | tr -d '[:space:]')

# Remove any stale 3-file outputs from a previous run in this OUT dir.
rm -f "$REMAINING" "$OUT"/verify_*.txt

# ---- 3) slice the pool in order: first N -> next N -> rest ------------------
V1_COUNT=0; V2_COUNT=0; REMAINING_COUNT=0
if [[ "$POOL_COUNT" -eq 0 ]]; then
  echo ">> pool is empty (master minus excludes = 0). No verify/remaining files created." >&2
else
  # verify_1 = lines [1 .. FIRST]
  if [[ "$FIRST" -gt 0 ]]; then
    head -n "$FIRST" "$POOL" > "$VERIFY1"
    V1_COUNT=$(wc -l < "$VERIFY1" | tr -d '[:space:]')
  fi
  # verify_2 = lines [FIRST+1 .. FIRST+SECOND]
  if [[ "$SECOND" -gt 0 && "$POOL_COUNT" -gt "$FIRST" ]]; then
    tail -n +"$((FIRST + 1))" "$POOL" | head -n "$SECOND" > "$VERIFY2"
    V2_COUNT=$(wc -l < "$VERIFY2" | tr -d '[:space:]')
  fi
  # remaining = lines [FIRST+SECOND+1 .. end]
  REST_START=$((FIRST + SECOND + 1))
  if [[ "$POOL_COUNT" -ge "$REST_START" ]]; then
    tail -n +"$REST_START" "$POOL" > "$REMAINING"
    REMAINING_COUNT=$(wc -l < "$REMAINING" | tr -d '[:space:]')
  fi
fi
rm -f "$POOL"

# ---- summary ----------------------------------------------------------------
{
  echo "================ make-batches summary ================"
  echo "master (all_affected) : $MASTER_COUNT"
  echo "excluded (cohorts)    : $EXCLUDED_COUNT"
  echo "pool (master-excludes): $POOL_COUNT"
  echo "-- sliced into 3 files --"
  [[ "$V1_COUNT" -gt 0 ]]        && echo "$(basename "$VERIFY1")           : $V1_COUNT"        || echo "verify_1              : 0 (not created)"
  [[ "$V2_COUNT" -gt 0 ]]        && echo "$(basename "$VERIFY2")           : $V2_COUNT"        || echo "verify_2              : 0 (not created)"
  [[ "$REMAINING_COUNT" -gt 0 ]] && echo "remaining.txt         : $REMAINING_COUNT" || echo "remaining.txt         : 0 (not created)"
  echo "output dir            : $OUT"
  echo "(you MAY hand-edit the verify_* files to pick specific known-leak users)"
  echo "======================================================"
  if [[ "$POOL_COUNT" -gt 0 ]]; then
    echo "Suggested 3-step run (set ORG first):"
    [[ "$V1_COUNT" -gt 0 ]]        && echo "  ./run.sh --org \"\$ORG\" --run-id cleanse-v$FIRST  --users-file $VERIFY1 --delete   # then verify an export"
    [[ "$V2_COUNT" -gt 0 ]]        && echo "  ./run.sh --org \"\$ORG\" --run-id cleanse-v$SECOND --users-file $VERIFY2 --delete   # then verify again"
    [[ "$REMAINING_COUNT" -gt 0 ]] && echo "  ./run.sh --org \"\$ORG\" --run-id cleanse-rest --users-file $REMAINING --group 20 --delete"
  fi
} >&2
