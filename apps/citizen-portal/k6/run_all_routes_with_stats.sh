#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}"

# Resource limits (can be overridden by env vars)
# These should match the docker:start:flame command in package.json
# --cpus=1.25 --memory=1G
CPU_LIMIT_CORES="${CPU_LIMIT_CORES:-1.25}"
MEM_LIMIT_MIB="${MEM_LIMIT_MIB:-1024}"

# Track background PIDs and container IDs for cleanup
STATS_PIDS=()
CONTAINER_IDS=()

# -----------------------------------------------------------------------------
# Colors (disabled if NO_COLOR set or stdout is not a TTY)
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
dim()     { echo -e "${C_DIM}$*${C_RESET}"; }
label()   { echo -e "  ${C_DIM}$1${C_RESET} $2"; }

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------

cleanup() {
  # Temporarily allow unset arrays so Ctrl-C before any route completes doesn't error
  set +u
  for pid in "${STATS_PIDS[@]}"; do
    [ -n "$pid" ] && kill "$pid" >/dev/null 2>&1 && wait "$pid" 2>/dev/null || true
  done
  for container_id in "${CONTAINER_IDS[@]}"; do
    [ -n "$container_id" ] && docker ps -q --no-trunc | grep -q "^${container_id}$" && \
      info "Stopping container ${container_id}..." && \
      docker stop "${container_id}" >/dev/null 2>&1 || true
  done
  set -u
}

trap cleanup EXIT INT TERM

# -----------------------------------------------------------------------------
# Requirements
# -----------------------------------------------------------------------------

check_requirements() {
  local missing=()
  command -v gnuplot >/dev/null 2>&1 || missing+=(gnuplot)
  command -v docker >/dev/null 2>&1 || missing+=(docker)
  command -v pnpm >/dev/null 2>&1 || missing+=(pnpm)
  command -v curl >/dev/null 2>&1 || missing+=(curl)
  if [ ${#missing[@]} -gt 0 ]; then
    error_msg "Missing required commands: ${missing[*]}. Please install and re-run."
    exit 1
  fi
  
  # Check if Docker daemon is responsive
  info "Checking Docker daemon..."
  if ! docker info >/dev/null 2>&1; then
    error_msg "Docker daemon is not responding. Please start Docker and re-run."
    exit 1
  fi
  success "Docker daemon is responsive"
}

# -----------------------------------------------------------------------------
# Container lifecycle
# -----------------------------------------------------------------------------

# Run docker ps with optional timeout to avoid hanging (e.g. daemon slow)
docker_ps_quick() {
  if command -v timeout >/dev/null 2>&1; then
    timeout 10 docker ps "$@" 2>/dev/null || true
  else
    docker ps "$@" 2>/dev/null || true
  fi
}

find_container() {
  local containers_before="$1"
  local docker_pid="$2"

  info "Finding container..." >&2

  local container_id=""
  local containers_after
  containers_after=$(docker_ps_quick -q)

  # Prefer container publishing port 3000 (most reliable)
  if [ -z "${container_id}" ]; then
    container_id=$(docker_ps_quick --filter "publish=3000" --format "{{.ID}}" | head -n 1)
  fi
  if [ -z "${container_id}" ] && [ -n "${containers_before}" ] && [ -n "${containers_after}" ]; then
    container_id=$(comm -13 <(echo "${containers_before}" | sort) <(echo "${containers_after}" | sort) | head -n 1)
  fi
  if [ -z "${container_id}" ]; then
    container_id=$(docker_ps_quick --filter "ancestor=messaging-next" --format "{{.ID}}" | head -n 1)
  fi
  if [ -z "${container_id}" ]; then
    if ! kill -0 "${docker_pid}" 2>/dev/null; then
      error_msg "ERROR: docker:start:flame process died." >&2
      return 1
    fi
    info "Waiting for container to appear..." >&2
    sleep 5
    container_id=$(docker_ps_quick --filter "publish=3000" --format "{{.ID}}" | head -n 1)
  fi
  if [ -z "${container_id}" ]; then
    container_id=$(docker_ps_quick --filter "ancestor=messaging-next" --format "{{.ID}}" | head -n 1)
  fi
  if [ -z "${container_id}" ]; then
    error_msg "ERROR: Could not find container." >&2
    return 1
  fi

  local container_name
  container_name=$(docker_ps_quick --filter "id=${container_id}" --format "{{.Names}}")
  [ -z "${container_name}" ] && container_name="${container_id}"

  echo "${container_id}" "${container_name}"
  return 0
}

wait_for_container_ready() {
  local max_wait="${1:-30}"
  local waited=0
  while ! curl -s http://localhost:3000 >/dev/null 2>&1; do
    if [ "${waited}" -ge "${max_wait}" ]; then
      warn "WARNING: Container did not become ready within ${max_wait}s, proceeding anyway..."
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
}

stop_and_remove_container() {
  local container_name="$1"
  info "Stopping and removing container ${container_name}..."
  docker stop "${container_name}" >/dev/null 2>&1 || true
  docker rm "${container_name}" >/dev/null 2>&1 || true
}

# -----------------------------------------------------------------------------
# Flame profiling
# -----------------------------------------------------------------------------

flush_flame_profiles() {
  local container_name="$1"
  info "Sending SIGUSR2 to next-server process in container ${container_name}..."
  
  # Find the actual next-server process (not the flame wrapper)
  # The real next-server shows as "next-server (vX.Y.Z)" in ps output
  local next_server_pid
  next_server_pid=$(docker exec "${container_name}" sh -c 'ps aux | grep "next-server (v" | grep -v grep | awk "{print \$1}"' 2>/dev/null | tr -d '\n\r ')
  
  if [ -z "${next_server_pid}" ]; then
    warn "Could not find next-server process"
    docker exec "${container_name}" ps aux
    return 1
  fi
  
  dim "Found next-server process with PID ${next_server_pid} inside container"
  if docker exec "${container_name}" kill -USR2 "${next_server_pid}" 2>&1; then
    success "Signal sent successfully to PID ${next_server_pid}"
  else
    warn "Failed to send signal"
  fi
  
  dim "Waiting for Flame to generate .pb files..."
  sleep 5
}

collect_flame_profiles() {
  local container_name="$1"

  info "Extracting Flame profile filenames from container logs..."
  
  # Get the log output and parse filenames from "profile written to:" lines
  local pb_files
  pb_files=$(docker logs "${container_name}" 2>&1 | grep -oE "(cpu|heap)-profile-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{3}Z\.pb")
  
  if [ -z "${pb_files}" ]; then
    warn "No Flame .pb files found in container logs."
    return 0
  fi

  local pb_count=0
  while IFS= read -r pb_filename; do
    [ -z "${pb_filename}" ] && continue
    
    dim "Copying ${pb_filename}..."
    if docker cp "${container_name}:/app/apps/messaging-next/${pb_filename}" "${OUTPUT_DIR}/" 2>&1; then
      pb_count=$((pb_count + 1))
      
      local base_name
      base_name="$(basename "${pb_filename}" .pb)"
      local html_out="${OUTPUT_DIR}/${base_name}.html"
      
      dim "Generating flamegraph for ${base_name}..."
      if command -v flame >/dev/null 2>&1; then
        flame generate -o "${html_out}" "${OUTPUT_DIR}/${pb_filename}" >/dev/null 2>&1 || true
      else
        npx --yes @platformatic/flame generate -o "${html_out}" "${OUTPUT_DIR}/${pb_filename}" >/dev/null 2>&1 || true
      fi
    else
      warn "Failed to copy ${pb_filename}"
    fi
  done <<< "${pb_files}"

  if [ "${pb_count}" -eq 0 ]; then
    warn "No Flame .pb files were successfully copied."
  else
    success "Copied ${pb_count} .pb file(s) and generated flamegraphs in ${OUTPUT_DIR}"
  fi
}

# -----------------------------------------------------------------------------
# Docker stats and gnuplot
# -----------------------------------------------------------------------------

start_docker_stats_sampler() {
  local container_name="$1"
  local stats_raw="$2"
  while true; do
    docker stats --no-stream --format "{{.Name}} {{.CPUPerc}} {{.MemUsage}}" "${container_name}" >> "${stats_raw}" 2>/dev/null || true
    sleep 5
  done
}

parse_docker_stats() {
  local stats_raw="$1"
  local stats_dat="$2"
  awk -v cpu_limit_cores="${CPU_LIMIT_CORES}" -v mem_limit_mib="${MEM_LIMIT_MIB}" '
    BEGIN {
      sample = 0;
      OFS = " ";
      cpu_limit_pct = cpu_limit_cores * 100.0;
    }
    {
      name = $1;
      cpu = $2;
      memUsage = $3;
      gsub(/%/, "", cpu);
      split(memUsage, parts, "/");
      memVal = parts[1];
      if (memVal ~ /GiB$/) {
        gsub(/GiB/, "", memVal);
        memMiB = memVal * 1024.0;
      } else if (memVal ~ /MiB$/) {
        gsub(/MiB/, "", memVal);
        memMiB = memVal;
      } else if (memVal ~ /KiB$/) {
        gsub(/KiB/, "", memVal);
        memMiB = memVal / 1024.0;
      } else {
        memMiB = memVal;
      }
      cpu_pct_of_limit = (cpu_limit_pct > 0 ? (cpu / cpu_limit_pct) * 100.0 : 0);
      mem_pct_of_limit = (mem_limit_mib > 0 ? (memMiB / mem_limit_mib) * 100.0 : 0);
      sample++;
      print sample, cpu, memMiB, cpu_pct_of_limit, mem_pct_of_limit;
    }
  ' "${stats_raw}" > "${stats_dat}"
}

generate_gnuplot_png() {
  local stats_dat="$1"
  local png_output="$2"
  local gnuplot_script="$3"
  local container_name="$4"
  local route_name="$5"

  cat > "${gnuplot_script}" <<EOF
set terminal png size 1200,800
set output '${png_output}'
set multiplot layout 2,1 title "Docker Container Stats - ${container_name} (${route_name})"
set xlabel "Sample #"
set ylabel "CPU %"
set title "CPU Usage Over Time"
set grid
plot '${stats_dat}' using 1:2 with linespoints title 'CPU %' lw 2 pt 7
set xlabel "Sample #"
set ylabel "Memory (MiB)"
set title "Memory Usage Over Time"
set grid
plot '${stats_dat}' using 1:3 with linespoints title 'Memory' lw 2 pt 7
unset multiplot
EOF
  gnuplot "${gnuplot_script}"
}

# -----------------------------------------------------------------------------
# k6 test run
# -----------------------------------------------------------------------------

run_k6_test() {
  local pnpm_script="$1"
  local k6_log="$2"
  (
    cd "${APP_DIR}"
    PNPM_SCRIPT="${pnpm_script}" pnpm run "${pnpm_script}"
  ) 2>&1 | tee "${k6_log}"
}

# -----------------------------------------------------------------------------
# Main route runner
# -----------------------------------------------------------------------------

run_with_stats() {
  local route_name="$1"
  local pnpm_script="$2"

  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"

  local k6_log="${OUTPUT_DIR}/k6-${route_name}-${timestamp}.log"
  local stats_raw="${OUTPUT_DIR}/docker-stats-${route_name}-${timestamp}.raw"
  local stats_dat="${OUTPUT_DIR}/docker-stats-${route_name}-${timestamp}.dat"
  local png_output="${OUTPUT_DIR}/docker-stats-${route_name}-${timestamp}.png"
  local gnuplot_script="${OUTPUT_DIR}/plot_${route_name}_${timestamp}.gnu"

  echo ""
  header "============================================================"
  header "  Route: ${route_name}  |  ${timestamp}"
  header "============================================================"
  label "K6 log:" "${k6_log}"
  label "Docker stats raw:" "${stats_raw}"
  label "Docker stats dat:" "${stats_dat}"
  label "PNG output:" "${png_output}"
  echo ""

  # Start container
  info "Starting Docker container with flame profiling..."
  dim "Listing running containers..."
  local containers_before
  containers_before=$(docker_ps_quick -q)
  dim "Launching flame container process..."
  (
    cd "${APP_DIR}"
    pnpm docker:start:flame >/dev/null 2>&1
  ) &
  local docker_pid=$!
  dim "Waiting 3s for container to initialize..."
  sleep 3

  # Find container ID and name (find_container prints progress to stderr)
  dim "Resolving container ID and name..."
  local container_id container_name
  read -r container_id container_name < <(find_container "${containers_before}" "${docker_pid}")
  
  if [ -z "${container_id}" ]; then
    error_msg "Failed to find container. Debug info:"
    docker ps --format "table {{.ID}}\\t{{.Image}}\\t{{.Ports}}"
    error_msg "Docker process PID: ${docker_pid}"
    exit 1
  fi
  
  CONTAINER_IDS+=("${container_id}")
  CONTAINER_NAME="${container_name}"

  success "Container started: ${container_name} (ID: ${container_id})"
  info "Waiting for container to be ready..."
  wait_for_container_ready 30
  success "Container is ready. Starting test..."

  # Start stats sampler
  start_docker_stats_sampler "${container_name}" "${stats_raw}" &
  local stats_pid=$!
  STATS_PIDS+=("${stats_pid}")

  # Run k6
  run_k6_test "${pnpm_script}" "${k6_log}"

  # Flush Flame profiles (SIGUSR2), then stop stats sampler
  flush_flame_profiles "${container_name}"
  kill "${stats_pid}" >/dev/null 2>&1 || true
  wait "${stats_pid}" 2>/dev/null || true

  # Build stats.dat and gnuplot PNG
  parse_docker_stats "${stats_raw}" "${stats_dat}"
  generate_gnuplot_png "${stats_dat}" "${png_output}" "${gnuplot_script}" "${container_name}" "${route_name}"

  success "Finished route '${route_name}'. Outputs:"
  label "K6 log:" "${k6_log}"
  label "Docker data:" "${stats_dat}"
  label "PNG:" "${png_output}"
  echo ""

  # Copy Flame .pb, generate HTML/md, then stop container
  collect_flame_profiles "${container_name}"
  stop_and_remove_container "${container_name}"
  echo
}

# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------

main() {
  check_requirements

  local run_timestamp
  run_timestamp="$(date +%Y%m%d-%H%M%S)"
  OUTPUT_DIR="${SCRIPT_DIR}/run-${run_timestamp}"
  mkdir -p "${OUTPUT_DIR}"

  run_with_stats "messages" "test:k6:route:messages"

  echo ""
  success "All k6 route tests completed with docker stats and PNGs generated."
}

main "$@"
