#!/usr/bin/env bash

# =============================================================================
# K6 Benchmark Suite Runner
# =============================================================================
# Executes the full k6 load test suite multiple times for statistical analysis.
#
# Usage:
#   ./run_benchmark_suite.sh [iterations]
#
# Arguments:
#   iterations  Number of times to run the full test suite (default: 10)
#
# Output:
#   Creates a benchmark-YYYYMMDD-HHMMSS folder containing:
#   - Individual run folders (run-YYYYMMDD-HHMMSS)
#   - BENCHMARK_SUMMARY.md with statistical analysis
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ITERATIONS="${1:-10}"

# -----------------------------------------------------------------------------
# Colors
# -----------------------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET='\033[0m'
  C_BOLD='\033[1m'
  C_DIM='\033[2m'
  C_RED='\033[31m'
  C_GREEN='\033[32m'
  C_YELLOW='\033[33m'
  C_BLUE='\033[34m'
  C_CYAN='\033[36m'
  C_MAGENTA='\033[35m'
else
  C_RESET=''
  C_BOLD=''
  C_DIM=''
  C_RED=''
  C_GREEN=''
  C_YELLOW=''
  C_BLUE=''
  C_CYAN=''
  C_MAGENTA=''
fi

info()    { echo -e "${C_CYAN}$*${C_RESET}"; }
success() { echo -e "${C_GREEN}$*${C_RESET}"; }
warn()    { echo -e "${C_YELLOW}$*${C_RESET}"; }
error_msg() { echo -e "${C_RED}$*${C_RESET}"; }
header()  { echo -e "${C_BOLD}${C_BLUE}$*${C_RESET}"; }

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
  local benchmark_timestamp
  benchmark_timestamp="$(date +%Y%m%d-%H%M%S)"
  local benchmark_dir="${SCRIPT_DIR}/benchmark-${benchmark_timestamp}"
  mkdir -p "${benchmark_dir}"
  
  local run_dirs=()
  local start_time
  start_time=$(date +%s)
  
  echo ""
  header "╔═══════════════════════════════════════════════════════════════════╗"
  header "║               K6 BENCHMARK SUITE                                  ║"
  header "╠═══════════════════════════════════════════════════════════════════╣"
  header "║  Iterations: ${ITERATIONS}                                                   ║"
  header "║  Output Dir: benchmark-${benchmark_timestamp}                    ║"
  header "║  Started:    $(date '+%Y-%m-%d %H:%M:%S')                              ║"
  header "╚═══════════════════════════════════════════════════════════════════╝"
  echo ""

  for i in $(seq 1 "${ITERATIONS}"); do
    echo ""
    header "════════════════════════════════════════════════════════════════════"
    header "  ITERATION ${i} of ${ITERATIONS}"
    header "  Started: $(date '+%Y-%m-%d %H:%M:%S')"
    header "════════════════════════════════════════════════════════════════════"
    echo ""
    
    # Run the test suite
    if "${SCRIPT_DIR}/run_all_routes_with_stats.sh"; then
      success "Iteration ${i} completed successfully"
    else
      warn "Iteration ${i} completed with warnings"
    fi
    
    # Find the most recent run folder
    local latest_run
    latest_run=$(find "${SCRIPT_DIR}" -maxdepth 1 -type d -name "run-*" | sort -r | head -1)
    
    if [ -n "${latest_run}" ] && [ -d "${latest_run}" ]; then
      local run_name
      run_name=$(basename "${latest_run}")
      # Move to benchmark directory
      mv "${latest_run}" "${benchmark_dir}/${run_name}"
      run_dirs+=("${benchmark_dir}/${run_name}")
      success "Moved ${run_name} to benchmark directory"
    else
      warn "Could not find run folder for iteration ${i}"
    fi
    
    # Progress summary
    local elapsed=$(($(date +%s) - start_time))
    local avg_per_run=$((elapsed / i))
    local estimated_remaining=$(((ITERATIONS - i) * avg_per_run))
    
    echo ""
    info "Progress: ${i}/${ITERATIONS} iterations complete"
    info "Elapsed: $((elapsed / 60))m $((elapsed % 60))s | Estimated remaining: $((estimated_remaining / 60))m $((estimated_remaining % 60))s"
    echo ""
    
    # Small pause between iterations to let system stabilize
    if [ "${i}" -lt "${ITERATIONS}" ]; then
      info "Waiting 30 seconds before next iteration..."
      sleep 30
    fi
  done
  
  local total_elapsed=$(($(date +%s) - start_time))
  
  echo ""
  header "╔═══════════════════════════════════════════════════════════════════╗"
  header "║               BENCHMARK SUITE COMPLETE                            ║"
  header "╠═══════════════════════════════════════════════════════════════════╣"
  header "║  Total iterations: ${ITERATIONS}                                              ║"
  header "║  Total time: $((total_elapsed / 60))m $((total_elapsed % 60))s                                           ║"
  header "║  Average per run: $((total_elapsed / ITERATIONS / 60))m $((total_elapsed / ITERATIONS % 60))s                                       ║"
  header "╚═══════════════════════════════════════════════════════════════════╝"
  echo ""
  
  # Write manifest file for the analysis script
  {
    echo "# Benchmark manifest"
    echo "benchmark_timestamp=${benchmark_timestamp}"
    echo "iterations=${ITERATIONS}"
    echo "total_elapsed=${total_elapsed}"
    echo "cpu_limit_cores=${CPU_LIMIT_CORES:-1.25}"
    echo "mem_limit_mib=${MEM_LIMIT_MIB:-1024}"
    echo "run_dirs:"
    for dir in "${run_dirs[@]}"; do
      echo "  - $(basename "$dir")"
    done
  } > "${benchmark_dir}/MANIFEST.txt"
  
  success "All ${ITERATIONS} iterations completed!"
  info "Run folders saved to: ${benchmark_dir}"
  echo ""
  info "To generate analysis report, run:"
  echo "  ./analyze_benchmark.sh ${benchmark_dir}"
  echo ""
}

main "$@"
