#!/usr/bin/env bash

# =============================================================================
# K6 Benchmark Analysis Script
# =============================================================================
# Analyzes multiple k6 benchmark runs and generates a comprehensive report.
#
# Usage:
#   ./analyze_benchmark.sh <benchmark_directory>
#   ./analyze_benchmark.sh benchmark-20260129-165222
#
# Output:
#   Creates BENCHMARK_SUMMARY.md in the benchmark directory
# =============================================================================

set -uo pipefail
# Note: -e removed because the script handles errors gracefully with || fallbacks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# -----------------------------------------------------------------------------
# Colors
# -----------------------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET='\033[0m'
  C_BOLD='\033[1m'
  C_GREEN='\033[32m'
  C_YELLOW='\033[33m'
  C_BLUE='\033[34m'
  C_CYAN='\033[36m'
  C_RED='\033[31m'
else
  C_RESET=''
  C_BOLD=''
  C_GREEN=''
  C_YELLOW=''
  C_BLUE=''
  C_CYAN=''
  C_RED=''
fi

info()    { echo -e "${C_CYAN}$*${C_RESET}"; }
success() { echo -e "${C_GREEN}$*${C_RESET}"; }
warn()    { echo -e "${C_YELLOW}$*${C_RESET}"; }
error_msg() { echo -e "${C_RED}$*${C_RESET}" >&2; }
header()  { echo -e "${C_BOLD}${C_BLUE}$*${C_RESET}"; }

# -----------------------------------------------------------------------------
# Parse k6 log to extract metrics
# Returns: avg,min,med,max,p50,p90,p95,p99,requests,throughput,error_rate
# -----------------------------------------------------------------------------
parse_k6_log() {
  local log_file="$1"
  local route="$2"
  
  if [ ! -f "${log_file}" ]; then
    echo ",,,,,,,,,,,"
    return
  fi
  
  # Extract the metrics line for the specific route
  local metrics_line
  metrics_line=$(grep -E "^\s+${route}_duration\.+:" "${log_file}" | head -1 || echo "")
  
  if [ -z "${metrics_line}" ]; then
    echo ",,,,,,,,,,,"
    return
  fi
  
  # Parse: avg=17.17ms  min=801µs   med=4.61ms   max=542.43ms p(50)=4.61ms   p(90)=24.85ms  p(95)=64.41ms  p(99)=327.84ms
  local avg min med max p50 p90 p95 p99
  
  avg=$(echo "${metrics_line}" | grep -oE 'avg=[0-9.]+[µm]?s?' | sed 's/avg=//' | head -1)
  min=$(echo "${metrics_line}" | grep -oE 'min=[0-9.]+[µm]?s?' | sed 's/min=//' | head -1)
  med=$(echo "${metrics_line}" | grep -oE 'med=[0-9.]+[µm]?s?' | sed 's/med=//' | head -1)
  max=$(echo "${metrics_line}" | grep -oE 'max=[0-9.]+[µm]?s?' | sed 's/max=//' | head -1)
  p50=$(echo "${metrics_line}" | grep -oE 'p\(50\)=[0-9.]+[µm]?s?' | sed 's/p(50)=//' | head -1)
  p90=$(echo "${metrics_line}" | grep -oE 'p\(90\)=[0-9.]+[µm]?s?' | sed 's/p(90)=//' | head -1)
  p95=$(echo "${metrics_line}" | grep -oE 'p\(95\)=[0-9.]+[µm]?s?' | sed 's/p(95)=//' | head -1)
  p99=$(echo "${metrics_line}" | grep -oE 'p\(99\)=[0-9.]+[µm]?s?' | sed 's/p(99)=//' | head -1)
  
  # Extract requests and throughput
  local requests_line
  requests_line=$(grep -E "^\s+${route}_requests\.+:" "${log_file}" | head -1 || echo "")
  local requests throughput
  requests=$(echo "${requests_line}" | awk '{print $2}')
  throughput=$(echo "${requests_line}" | awk '{print $3}')
  
  # Extract error rate
  local errors_line
  errors_line=$(grep -E "^\s+${route}_errors\.+:" "${log_file}" | head -1 || echo "")
  local error_rate
  error_rate=$(echo "${errors_line}" | grep -oE '[0-9.]+%' | head -1)
  
  echo "${avg},${min},${med},${max},${p50},${p90},${p95},${p99},${requests},${throughput},${error_rate}"
}

# -----------------------------------------------------------------------------
# Parse docker stats dat file for CPU/memory metrics
# Returns: avg_cpu,max_cpu,avg_mem,max_mem
# -----------------------------------------------------------------------------
parse_docker_stats() {
  local dat_file="$1"
  
  if [ ! -f "${dat_file}" ]; then
    echo ",,,"
    return
  fi
  
  # dat format: sample cpu% mem_mib cpu_pct_of_limit mem_pct_of_limit
  # Calculate avg and max for CPU and Memory
  awk '
    BEGIN { 
      cpu_sum=0; cpu_max=0; mem_sum=0; mem_max=0; count=0 
    }
    {
      cpu = $2
      mem = $3
      cpu_sum += cpu
      mem_sum += mem
      if (cpu > cpu_max) cpu_max = cpu
      if (mem > mem_max) mem_max = mem
      count++
    }
    END {
      if (count > 0) {
        printf "%.1f,%.1f,%.1f,%.1f", cpu_sum/count, cpu_max, mem_sum/count, mem_max
      } else {
        print ",,,"
      }
    }
  ' "${dat_file}"
}

# -----------------------------------------------------------------------------
# Parse flame profile markdown to extract hotspots
# Returns top 5 hotspots as: func1:self%:cum%,func2:self%:cum%,...
# -----------------------------------------------------------------------------
parse_flame_profile() {
  local md_file="$1"
  local profile_type="$2"  # "cpu" or "heap"
  
  if [ ! -f "${md_file}" ]; then
    echo ""
    return
  fi
  
  # Extract the hotspot table rows (after header, up to 5 rows)
  # Format: | Rank | Function | Self% | Cum% | Location |
  awk '
    BEGIN { in_table=0; count=0 }
    /^\| Rank \| Function/ { in_table=1; next }
    /^\|------/ { next }
    in_table && /^\| [0-9]+ \|/ && count < 5 {
      # Parse table row
      gsub(/\|/, " ")
      gsub(/`/, "")
      n = split($0, a, /[[:space:]]+/)
      # a[2]=rank, a[3]=function, a[4]=self%, a[5]=cum%
      if (a[3] != "" && a[4] != "") {
        gsub(/%/, "", a[4])
        gsub(/%/, "", a[5])
        if (count > 0) printf ","
        printf "%s:%s:%s", a[3], a[4], a[5]
        count++
      }
    }
    /^$/ && in_table { in_table=0 }
  ' "${md_file}"
}

# -----------------------------------------------------------------------------
# Extract critical paths from flame profile
# -----------------------------------------------------------------------------
extract_critical_paths() {
  local md_file="$1"
  
  if [ ! -f "${md_file}" ]; then
    echo ""
    return
  fi
  
  # Extract top 3 critical paths
  grep -E '^\d+\.\s+\*\*\[' "${md_file}" 2>/dev/null | head -3 | sed 's/^[0-9]*\. //' || echo ""
}

# Convert time value to milliseconds for comparison
to_ms() {
  local val="$1"
  if [ -z "$val" ]; then
    echo ""
    return
  fi
  if [[ "$val" == *"µs"* ]]; then
    echo "$val" | sed 's/µs//' | awk '{printf "%.3f", $1/1000}'
  elif [[ "$val" == *"ms"* ]]; then
    echo "$val" | sed 's/ms//'
  elif [[ "$val" == *"s"* ]]; then
    echo "$val" | sed 's/s//' | awk '{printf "%.3f", $1*1000}'
  else
    echo "$val"
  fi
}

# -----------------------------------------------------------------------------
# Main analysis
# -----------------------------------------------------------------------------

main() {
  local benchmark_dir="${1:-}"
  
  if [ -z "${benchmark_dir}" ]; then
    error_msg "Usage: $0 <benchmark_directory>"
    error_msg "Example: $0 benchmark-20260129-165222"
    exit 1
  fi
  
  if [ ! -d "${benchmark_dir}" ]; then
    # Try relative to script dir
    if [ -d "${SCRIPT_DIR}/${benchmark_dir}" ]; then
      benchmark_dir="${SCRIPT_DIR}/${benchmark_dir}"
    else
      error_msg "Directory not found: ${benchmark_dir}"
      exit 1
    fi
  fi
  
  local output_file="${benchmark_dir}/BENCHMARK_SUMMARY.md"
  local csv_file="${benchmark_dir}/benchmark_data.csv"
  
  header "Analyzing benchmark directory: ${benchmark_dir}"
  
  # Find all run directories
  local run_dirs=()
  while IFS= read -r dir; do
    [ -n "$dir" ] && run_dirs+=("$dir")
  done < <(find "${benchmark_dir}" -maxdepth 1 -type d -name "run-*" 2>/dev/null | sort)
  
  local num_runs=${#run_dirs[@]}
  
  if [ "${num_runs}" -eq 0 ]; then
    error_msg "No run directories found in ${benchmark_dir}"
    exit 1
  fi
  
  info "Found ${num_runs} run directories"
  
  # Routes to analyze
  local routes=("messages")
  local route_files=("messages")
  local route_names=("Messages")
  local route_paths=("/en/messages")
  
  # Initialize CSV
  echo "run,route,avg_ms,min_ms,med_ms,max_ms,p50_ms,p90_ms,p95_ms,p99_ms,requests,throughput,error_rate,avg_cpu,max_cpu,avg_mem,max_mem" > "${csv_file}"
  
  # Collect data for each run and route
  declare -A all_data
  declare -A all_cpu_data
  declare -A all_mem_data
  declare -A valid_runs  # Track which runs have valid data per route
  
  for i in "${!run_dirs[@]}"; do
    local run_dir="${run_dirs[$i]}"
    local run_name
    run_name=$(basename "${run_dir}")
    local run_num=$((i + 1))
    
    info "Processing ${run_name} (${run_num}/${num_runs})..."
    
    for j in "${!routes[@]}"; do
      local route="${routes[$j]}"
      local route_file="${route_files[$j]}"
      
      # Find the k6 log file for this route
      local log_file
      log_file=$(find "${run_dir}" -name "k6-${route_file}-*.log" 2>/dev/null | head -1)
      
      # Find the docker stats dat file for this route
      local dat_file
      dat_file=$(find "${run_dir}" -name "docker-stats-${route_file}-*.dat" 2>/dev/null | head -1)
      
      local metrics=""
      local docker_stats=""
      
      if [ -n "${log_file}" ] && [ -f "${log_file}" ]; then
        metrics=$(parse_k6_log "${log_file}" "${route}")
      fi
      
      if [ -n "${dat_file}" ] && [ -f "${dat_file}" ]; then
        docker_stats=$(parse_docker_stats "${dat_file}")
      fi
      
      # Store for later analysis
      all_data["${run_num}_${route}"]="${metrics}"
      
      # Parse docker stats
      if [ -n "${docker_stats}" ]; then
        IFS=',' read -r avg_cpu max_cpu avg_mem max_mem <<< "${docker_stats}"
        all_cpu_data["${run_num}_${route}"]="${avg_cpu},${max_cpu}"
        all_mem_data["${run_num}_${route}"]="${avg_mem},${max_mem}"
      fi
      
      # Write to CSV (convert to ms)
      IFS=',' read -r avg min med max p50 p90 p95 p99 requests throughput error_rate <<< "${metrics}"
      
      if [ -n "${avg}" ] && [ "${avg}" != "" ]; then
        valid_runs["${route}"]="${valid_runs["${route}"]:-}${run_num},"
        
        local avg_ms min_ms med_ms max_ms p50_ms p90_ms p95_ms p99_ms
        avg_ms=$(to_ms "$avg")
        min_ms=$(to_ms "$min")
        med_ms=$(to_ms "$med")
        max_ms=$(to_ms "$max")
        p50_ms=$(to_ms "$p50")
        p90_ms=$(to_ms "$p90")
        p95_ms=$(to_ms "$p95")
        p99_ms=$(to_ms "$p99")
        
        echo "${run_num},${route},${avg_ms},${min_ms},${med_ms},${max_ms},${p50_ms},${p90_ms},${p95_ms},${p99_ms},${requests},${throughput},${error_rate},${avg_cpu:-},${max_cpu:-},${avg_mem:-},${max_mem:-}" >> "${csv_file}"
      fi
    done
  done
  
  success "Data collection complete. Generating report..."
  
  # Read resource limits from manifest if available
  local cpu_limit_cores="1.25"
  local mem_limit_mib="1024"
  local manifest_file="${benchmark_dir}/MANIFEST.txt"
  if [ -f "${manifest_file}" ]; then
    local manifest_cpu manifest_mem
    manifest_cpu=$(grep "^cpu_limit_cores=" "${manifest_file}" 2>/dev/null | cut -d'=' -f2)
    manifest_mem=$(grep "^mem_limit_mib=" "${manifest_file}" 2>/dev/null | cut -d'=' -f2)
    [ -n "${manifest_cpu}" ] && cpu_limit_cores="${manifest_cpu}"
    [ -n "${manifest_mem}" ] && mem_limit_mib="${manifest_mem}"
  fi
  
  # Generate the markdown report
  {
    echo "# K6 Benchmark Analysis Report"
    echo ""
    echo "**Generated:** $(date '+%Y-%m-%d %H:%M:%S')"
    echo "**Benchmark Directory:** \`$(basename "${benchmark_dir}")\`"
    echo "**Number of Runs:** ${num_runs}"
    echo "**Resource Limits:** CPU ${cpu_limit_cores} cores, Memory ${mem_limit_mib} MiB"
    echo ""
    echo "---"
    echo ""
    echo "## Executive Summary"
    echo ""
    echo "This report analyzes ${num_runs} complete benchmark runs of the messages route."
    echo "Each run tested the route with progressive load (10 → 50 → 100 VUs)."
    echo ""
    
    # Calculate averages per route using awk
    echo "### Overall Averages Across All Runs"
    echo ""
    echo "| Route | Pattern | Avg Latency | P50 | P90 | P95 | P99 | Throughput | Avg CPU | Max CPU | Avg Mem | Max Mem |"
    echo "|-------|---------|-------------|-----|-----|-----|-----|------------|---------|---------|---------|---------|"
    
    # Arrays to store summary stats for conclusions
    declare -A route_avg_latency
    declare -A route_p95_latency
    declare -A route_cv
    declare -A route_avg_cpu
    declare -A route_max_cpu
    declare -A route_avg_mem
    declare -A route_max_mem
    declare -A route_throughput
    
    for j in "${!routes[@]}"; do
      local route="${routes[$j]}"
      local route_name="${route_names[$j]}"
      
      local avg_sum=0 p50_sum=0 p90_sum=0 p95_sum=0 p99_sum=0 throughput_sum=0
      local cpu_avg_sum=0 cpu_max_sum=0 mem_avg_sum=0 mem_max_sum=0
      local count=0 cpu_count=0
      
      for i in $(seq 1 "${num_runs}"); do
        local metrics="${all_data["${i}_${route}"]:-}"
        if [ -n "${metrics}" ]; then
          IFS=',' read -r avg min med max p50 p90 p95 p99 requests throughput error_rate <<< "${metrics}"
          
          if [ -n "${avg}" ] && [ "${avg}" != "" ]; then
            local avg_ms p50_ms p90_ms p95_ms p99_ms tput
            avg_ms=$(to_ms "$avg")
            p50_ms=$(to_ms "$p50")
            p90_ms=$(to_ms "$p90")
            p95_ms=$(to_ms "$p95")
            p99_ms=$(to_ms "$p99")
            tput=$(echo "$throughput" | tr -d '/s')
            
            if [ -n "${avg_ms}" ] && [ "${avg_ms}" != "" ]; then
              avg_sum=$(echo "${avg_sum} + ${avg_ms}" | bc -l 2>/dev/null || echo "${avg_sum}")
              p50_sum=$(echo "${p50_sum} + ${p50_ms}" | bc -l 2>/dev/null || echo "${p50_sum}")
              p90_sum=$(echo "${p90_sum} + ${p90_ms}" | bc -l 2>/dev/null || echo "${p90_sum}")
              p95_sum=$(echo "${p95_sum} + ${p95_ms}" | bc -l 2>/dev/null || echo "${p95_sum}")
              p99_sum=$(echo "${p99_sum} + ${p99_ms}" | bc -l 2>/dev/null || echo "${p99_sum}")
              throughput_sum=$(echo "${throughput_sum} + ${tput}" | bc -l 2>/dev/null || echo "${throughput_sum}")
              count=$((count + 1))
            fi
          fi
        fi
        
        # CPU/Memory stats
        local cpu_stats="${all_cpu_data["${i}_${route}"]:-}"
        local mem_stats="${all_mem_data["${i}_${route}"]:-}"
        if [ -n "${cpu_stats}" ]; then
          IFS=',' read -r c_avg c_max <<< "${cpu_stats}"
          if [ -n "${c_avg}" ]; then
            cpu_avg_sum=$(echo "${cpu_avg_sum} + ${c_avg}" | bc -l 2>/dev/null || echo "${cpu_avg_sum}")
            cpu_max_sum=$(echo "${cpu_max_sum} + ${c_max}" | bc -l 2>/dev/null || echo "${cpu_max_sum}")
          fi
        fi
        if [ -n "${mem_stats}" ]; then
          IFS=',' read -r m_avg m_max <<< "${mem_stats}"
          if [ -n "${m_avg}" ]; then
            mem_avg_sum=$(echo "${mem_avg_sum} + ${m_avg}" | bc -l 2>/dev/null || echo "${mem_avg_sum}")
            mem_max_sum=$(echo "${mem_max_sum} + ${m_max}" | bc -l 2>/dev/null || echo "${mem_max_sum}")
            cpu_count=$((cpu_count + 1))
          fi
        fi
      done
      
      if [ "${count}" -gt 0 ]; then
        local avg_avg p50_avg p90_avg p95_avg p99_avg throughput_avg
        avg_avg=$(echo "scale=2; ${avg_sum} / ${count}" | bc -l 2>/dev/null || echo "N/A")
        p50_avg=$(echo "scale=2; ${p50_sum} / ${count}" | bc -l 2>/dev/null || echo "N/A")
        p90_avg=$(echo "scale=2; ${p90_sum} / ${count}" | bc -l 2>/dev/null || echo "N/A")
        p95_avg=$(echo "scale=2; ${p95_sum} / ${count}" | bc -l 2>/dev/null || echo "N/A")
        p99_avg=$(echo "scale=2; ${p99_sum} / ${count}" | bc -l 2>/dev/null || echo "N/A")
        throughput_avg=$(echo "scale=1; ${throughput_sum} / ${count}" | bc -l 2>/dev/null || echo "N/A")
        
        # Store for conclusions
        route_avg_latency["${route}"]="${avg_avg}"
        route_p95_latency["${route}"]="${p95_avg}"
        route_throughput["${route}"]="${throughput_avg}"
        
        local cpu_avg_avg="" cpu_max_avg="" mem_avg_avg="" mem_max_avg=""
        if [ "${cpu_count}" -gt 0 ]; then
          cpu_avg_avg=$(echo "scale=1; ${cpu_avg_sum} / ${cpu_count}" | bc -l 2>/dev/null || echo "N/A")
          cpu_max_avg=$(echo "scale=1; ${cpu_max_sum} / ${cpu_count}" | bc -l 2>/dev/null || echo "N/A")
          mem_avg_avg=$(echo "scale=1; ${mem_avg_sum} / ${cpu_count}" | bc -l 2>/dev/null || echo "N/A")
          mem_max_avg=$(echo "scale=1; ${mem_max_sum} / ${cpu_count}" | bc -l 2>/dev/null || echo "N/A")
          
          route_avg_cpu["${route}"]="${cpu_avg_avg}"
          route_max_cpu["${route}"]="${cpu_max_avg}"
          route_avg_mem["${route}"]="${mem_avg_avg}"
          route_max_mem["${route}"]="${mem_max_avg}"
        fi
        
        echo "| \`${route}\` | ${route_name} | ${avg_avg}ms | ${p50_avg}ms | ${p90_avg}ms | ${p95_avg}ms | ${p99_avg}ms | ${throughput_avg}/s | ${cpu_avg_avg:-N/A}% | ${cpu_max_avg:-N/A}% | ${mem_avg_avg:-N/A}MB | ${mem_max_avg:-N/A}MB |"
      fi
    done
    
    echo ""
    echo "---"
    echo ""
    echo "## Resource Usage Summary"
    echo ""
    local cpu_limit_pct
    cpu_limit_pct=$(echo "scale=0; ${cpu_limit_cores} * 100 / 1" | bc -l 2>/dev/null || echo "125")
    echo "> **Container Limits:** CPU ${cpu_limit_cores} cores (${cpu_limit_pct}% max), Memory ${mem_limit_mib} MiB"
    echo ""
    echo "### CPU Usage by Route (Average Across Runs)"
    echo ""
    echo "| Route | Pattern | Avg CPU % | Peak CPU % | Notes |"
    echo "|-------|---------|-----------|------------|-------|"
    
    for j in "${!routes[@]}"; do
      local route="${routes[$j]}"
      local route_name="${route_names[$j]}"
      local avg_cpu="${route_avg_cpu["${route}"]:-N/A}"
      local max_cpu="${route_max_cpu["${route}"]:-N/A}"
      
      local notes=""
      local cpu_limit_pct
      cpu_limit_pct=$(echo "${cpu_limit_cores} * 100" | bc -l 2>/dev/null || echo "125")
      if [ "${max_cpu}" != "N/A" ] && [ "$(echo "${max_cpu} > ${cpu_limit_pct}" | bc -l 2>/dev/null || echo "0")" = "1" ]; then
        notes="⚠️ Exceeds limit (throttled)"
      elif [ "${max_cpu}" != "N/A" ] && [ "$(echo "${max_cpu} > (${cpu_limit_pct} * 0.8)" | bc -l 2>/dev/null || echo "0")" = "1" ]; then
        notes="Near CPU limit"
      fi
      
      echo "| \`${route}\` | ${route_name} | ${avg_cpu}% | ${max_cpu}% | ${notes} |"
    done
    
    echo ""
    echo "### Memory Usage by Route (Average Across Runs)"
    echo ""
    echo "| Route | Pattern | Avg Memory | Peak Memory | Notes |"
    echo "|-------|---------|------------|-------------|-------|"
    
    for j in "${!routes[@]}"; do
      local route="${routes[$j]}"
      local route_name="${route_names[$j]}"
      local avg_mem="${route_avg_mem["${route}"]:-N/A}"
      local max_mem="${route_max_mem["${route}"]:-N/A}"
      
      local notes=""
      local mem_threshold
      mem_threshold=$(echo "${mem_limit_mib} * 0.8" | bc -l 2>/dev/null || echo "819")
      if [ "${max_mem}" != "N/A" ] && [ "$(echo "${max_mem} > ${mem_limit_mib}" | bc -l 2>/dev/null || echo "0")" = "1" ]; then
        notes="⚠️ Exceeds limit (OOM risk)"
      elif [ "${max_mem}" != "N/A" ] && [ "$(echo "${max_mem} > ${mem_threshold}" | bc -l 2>/dev/null || echo "0")" = "1" ]; then
        notes="Approaching ${mem_limit_mib}MB limit"
      fi
      
      echo "| \`${route}\` | ${route_name} | ${avg_mem}MB | ${max_mem}MB | ${notes} |"
    done
    
    echo ""
    echo "---"
    echo ""
    echo "## Detailed Results by Run"
    echo ""
    
    # Table for each route showing all runs
    for j in "${!routes[@]}"; do
      local route="${routes[$j]}"
      local route_name="${route_names[$j]}"
      local route_file="${route_files[$j]}"
      
      echo "### ${route_name} (\`${route}\`)"
      echo ""
      echo "| Run | Avg | Min | Med | Max | P50 | P90 | P95 | P99 | Requests | Throughput | Errors | Avg CPU | Max CPU | Avg Mem | Max Mem |"
      echo "|-----|-----|-----|-----|-----|-----|-----|-----|-----|----------|------------|--------|---------|---------|---------|---------|"
      
      for i in $(seq 1 "${num_runs}"); do
        local metrics="${all_data["${i}_${route}"]:-}"
        local cpu_stats="${all_cpu_data["${i}_${route}"]:-}"
        local mem_stats="${all_mem_data["${i}_${route}"]:-}"
        
        local avg_cpu="" max_cpu="" avg_mem="" max_mem=""
        if [ -n "${cpu_stats}" ]; then
          IFS=',' read -r avg_cpu max_cpu <<< "${cpu_stats}"
        fi
        if [ -n "${mem_stats}" ]; then
          IFS=',' read -r avg_mem max_mem <<< "${mem_stats}"
        fi
        
        if [ -n "${metrics}" ]; then
          IFS=',' read -r avg min med max p50 p90 p95 p99 requests throughput error_rate <<< "${metrics}"
          if [ -n "${avg}" ] && [ "${avg}" != "" ]; then
            echo "| ${i} | ${avg} | ${min} | ${med} | ${max} | ${p50} | ${p90} | ${p95} | ${p99} | ${requests} | ${throughput} | ${error_rate} | ${avg_cpu:-N/A}% | ${max_cpu:-N/A}% | ${avg_mem:-N/A}MB | ${max_mem:-N/A}MB |"
          else
            echo "| ${i} | - | - | - | - | - | - | - | - | - | - | - | ${avg_cpu:-N/A}% | ${max_cpu:-N/A}% | ${avg_mem:-N/A}MB | ${max_mem:-N/A}MB |"
          fi
        else
          echo "| ${i} | - | - | - | - | - | - | - | - | - | - | - | ${avg_cpu:-N/A}% | ${max_cpu:-N/A}% | ${avg_mem:-N/A}MB | ${max_mem:-N/A}MB |"
        fi
      done
      
      echo ""
    done
    
    echo "---"
    echo ""
    echo "## Variance Analysis"
    echo ""
    echo "This section identifies patterns and anomalies across runs."
    echo ""
    
    # Calculate variance for each route
    for j in "${!routes[@]}"; do
      local route="${routes[$j]}"
      local route_name="${route_names[$j]}"
      
      echo "### ${route_name}"
      echo ""
      
      # Collect P95 values for variance calculation
      local p95_values=()
      local avg_values=()
      local run_labels=()
      
      for i in $(seq 1 "${num_runs}"); do
        local metrics="${all_data["${i}_${route}"]:-}"
        if [ -n "${metrics}" ]; then
          IFS=',' read -r avg min med max p50 p90 p95 p99 requests throughput error_rate <<< "${metrics}"
          
          if [ -n "${p95}" ] && [ "${p95}" != "" ]; then
            local p95_ms avg_ms
            p95_ms=$(to_ms "$p95")
            avg_ms=$(to_ms "$avg")
            
            if [ -n "${p95_ms}" ] && [ "${p95_ms}" != "" ]; then
              p95_values+=("${p95_ms}")
              avg_values+=("${avg_ms}")
              run_labels+=("${i}")
            fi
          fi
        fi
      done
      
      if [ ${#p95_values[@]} -gt 0 ]; then
        # Calculate min, max, average, std dev for P95
        local p95_min p95_max p95_avg p95_sum=0
        p95_min="${p95_values[0]}"
        p95_max="${p95_values[0]}"
        
        for val in "${p95_values[@]}"; do
          p95_sum=$(echo "${p95_sum} + ${val}" | bc -l 2>/dev/null || echo "${p95_sum}")
          if (( $(echo "${val} < ${p95_min}" | bc -l 2>/dev/null || echo "0") )); then
            p95_min="${val}"
          fi
          if (( $(echo "${val} > ${p95_max}" | bc -l 2>/dev/null || echo "0") )); then
            p95_max="${val}"
          fi
        done
        
        p95_avg=$(echo "scale=2; ${p95_sum} / ${#p95_values[@]}" | bc -l 2>/dev/null || echo "N/A")
        
        # Calculate standard deviation
        local variance_sum=0
        for val in "${p95_values[@]}"; do
          local diff
          diff=$(echo "${val} - ${p95_avg}" | bc -l 2>/dev/null || echo "0")
          variance_sum=$(echo "${variance_sum} + (${diff} * ${diff})" | bc -l 2>/dev/null || echo "0")
        done
        local variance std_dev
        variance=$(echo "scale=4; ${variance_sum} / ${#p95_values[@]}" | bc -l 2>/dev/null || echo "0")
        std_dev=$(echo "scale=2; sqrt(${variance})" | bc -l 2>/dev/null || echo "N/A")
        
        # Calculate coefficient of variation
        local cv
        cv=$(echo "scale=1; (${std_dev} / ${p95_avg}) * 100" | bc -l 2>/dev/null || echo "N/A")
        
        # Store CV for conclusions
        route_cv["${route}"]="${cv}"
        
        echo "**P95 Latency Statistics:**"
        echo "- Minimum: ${p95_min}ms"
        echo "- Maximum: ${p95_max}ms"
        echo "- Average: ${p95_avg}ms"
        echo "- Std Dev: ${std_dev}ms"
        echo "- Coefficient of Variation: ${cv}%"
        echo ""
        
        # Identify outliers (> 2 std dev from mean)
        local outliers=()
        for k in "${!p95_values[@]}"; do
          local val="${p95_values[$k]}"
          local diff
          diff=$(echo "(${val} - ${p95_avg})" | bc -l 2>/dev/null || echo "0")
          diff="${diff#-}"  # absolute value
          local threshold
          threshold=$(echo "2 * ${std_dev}" | bc -l 2>/dev/null || echo "999999")
          
          if (( $(echo "${diff} > ${threshold}" | bc -l 2>/dev/null || echo "0") )); then
            outliers+=("Run ${run_labels[$k]}: ${val}ms")
          fi
        done
        
        if [ ${#outliers[@]} -gt 0 ]; then
          echo "**Outliers (>2 std dev from mean):**"
          for outlier in "${outliers[@]}"; do
            echo "- ${outlier}"
          done
          echo ""
        else
          echo "**Outliers:** None detected"
          echo ""
        fi
      else
        echo "**Insufficient data for variance analysis**"
        echo ""
      fi
    done
    
    echo "---"
    echo ""
    echo "## Run-by-Run Comparison"
    echo ""
    echo "Best performing route per run (based on P95 latency):"
    echo ""
    echo "| Run | Best Route | P95 Latency | Worst Route | P95 Latency | Spread |"
    echo "|-----|------------|-------------|-------------|-------------|--------|"
    
    for i in $(seq 1 "${num_runs}"); do
      local best_route="" best_p95=999999 worst_route="" worst_p95=0
      
      for j in "${!routes[@]}"; do
        local route="${routes[$j]}"
        local metrics="${all_data["${i}_${route}"]:-}"
        if [ -n "${metrics}" ]; then
          IFS=',' read -r avg min med max p50 p90 p95 p99 requests throughput error_rate <<< "${metrics}"
          
          if [ -n "${p95}" ] && [ "${p95}" != "" ]; then
            local p95_ms
            p95_ms=$(to_ms "$p95")
            
            if [ -n "${p95_ms}" ] && [ "${p95_ms}" != "" ]; then
              if (( $(echo "${p95_ms} < ${best_p95}" | bc -l 2>/dev/null || echo "0") )); then
                best_p95="${p95_ms}"
                best_route="${route}"
              fi
              if (( $(echo "${p95_ms} > ${worst_p95}" | bc -l 2>/dev/null || echo "0") )); then
                worst_p95="${p95_ms}"
                worst_route="${route}"
              fi
            fi
          fi
        fi
      done
      
      if [ -n "${best_route}" ] && [ -n "${worst_route}" ]; then
        local spread
        spread=$(echo "scale=2; ${worst_p95} - ${best_p95}" | bc -l 2>/dev/null || echo "N/A")
        echo "| ${i} | ${best_route} | ${best_p95}ms | ${worst_route} | ${worst_p95}ms | ${spread}ms |"
      else
        echo "| ${i} | N/A | N/A | N/A | N/A | N/A |"
      fi
    done
    
    echo ""
    echo "---"
    echo ""
    echo "## Consistency Rankings"
    echo ""
    echo "Routes ranked by consistency (lower coefficient of variation = more predictable performance):"
    echo ""
    echo "| Rank | Route | Pattern | CV (P95) | Interpretation |"
    echo "|------|-------|---------|----------|----------------|"
    
    # Sort routes by CV
    local sorted_routes=()
    for route in "${routes[@]}"; do
      local cv="${route_cv["${route}"]:-999}"
      sorted_routes+=("${cv}:${route}")
    done
    IFS=$'\n' sorted_routes=($(sort -t: -k1 -n <<<"${sorted_routes[*]}")); unset IFS
    
    local rank=1
    for entry in "${sorted_routes[@]}"; do
      local cv="${entry%%:*}"
      local route="${entry#*:}"
      local interpretation=""
      
      if [ "${cv}" != "999" ]; then
        if (( $(echo "${cv} < 20" | bc -l 2>/dev/null || echo "0") )); then
          interpretation="Excellent - Very consistent"
        elif (( $(echo "${cv} < 40" | bc -l 2>/dev/null || echo "0") )); then
          interpretation="Good - Reasonably consistent"
        elif (( $(echo "${cv} < 60" | bc -l 2>/dev/null || echo "0") )); then
          interpretation="Fair - Some variability"
        else
          interpretation="Poor - High variability"
        fi
        
        # Find route name
        for j in "${!routes[@]}"; do
          if [ "${routes[$j]}" = "${route}" ]; then
            echo "| ${rank} | \`${route}\` | ${route_names[$j]} | ${cv}% | ${interpretation} |"
            break
          fi
        done
        rank=$((rank + 1))
      fi
    done
    
    echo ""
    echo "---"
    echo ""
    echo "## Conclusions and Recommendations"
    echo ""
    
    # Find best route by average latency
    local best_latency_route="" best_latency=999999
    local best_p95_route="" best_p95=999999
    local most_consistent_route="" lowest_cv=999
    local highest_throughput_route="" highest_throughput=0
    
    for route in "${routes[@]}"; do
      local lat="${route_avg_latency["${route}"]:-999999}"
      local p95="${route_p95_latency["${route}"]:-999999}"
      local cv="${route_cv["${route}"]:-999}"
      local tput="${route_throughput["${route}"]:-0}"
      
      if [ "${lat}" != "999999" ] && (( $(echo "${lat} < ${best_latency}" | bc -l 2>/dev/null || echo "0") )); then
        best_latency="${lat}"
        best_latency_route="${route}"
      fi
      if [ "${p95}" != "999999" ] && (( $(echo "${p95} < ${best_p95}" | bc -l 2>/dev/null || echo "0") )); then
        best_p95="${p95}"
        best_p95_route="${route}"
      fi
      if [ "${cv}" != "999" ] && (( $(echo "${cv} < ${lowest_cv}" | bc -l 2>/dev/null || echo "0") )); then
        lowest_cv="${cv}"
        most_consistent_route="${route}"
      fi
      if [ "${tput}" != "0" ] && (( $(echo "${tput} > ${highest_throughput}" | bc -l 2>/dev/null || echo "0") )); then
        highest_throughput="${tput}"
        highest_throughput_route="${route}"
      fi
    done
    
    echo "### Performance Winners"
    echo ""
    echo "| Category | Winner | Value |"
    echo "|----------|--------|-------|"
    echo "| **Lowest Avg Latency** | \`${best_latency_route}\` | ${best_latency}ms |"
    echo "| **Lowest P95 Latency** | \`${best_p95_route}\` | ${best_p95}ms |"
    echo "| **Most Consistent** | \`${most_consistent_route}\` | CV: ${lowest_cv}% |"
    echo "| **Highest Throughput** | \`${highest_throughput_route}\` | ${highest_throughput}/s |"
    echo ""
    
    echo "### Key Findings"
    echo ""
    echo "1. **Best Overall Performance:** \`${best_latency_route}\` achieved the lowest average latency (${best_latency}ms) across all ${num_runs} runs."
    echo ""
    echo "2. **Most Predictable Performance:** \`${most_consistent_route}\` showed the most consistent results with a coefficient of variation of ${lowest_cv}%, indicating predictable behavior under load."
    echo ""
    
    # Check for high variance routes
    local high_variance_routes=()
    for route in "${routes[@]}"; do
      local cv="${route_cv["${route}"]:-0}"
      if (( $(echo "${cv} > 50" | bc -l 2>/dev/null || echo "0") )); then
        high_variance_routes+=("${route}")
      fi
    done
    
    if [ ${#high_variance_routes[@]} -gt 0 ]; then
      echo "3. **Variability Concerns:** The following routes showed high variability (CV > 50%):"
      for route in "${high_variance_routes[@]}"; do
        echo "   - \`${route}\` (CV: ${route_cv["${route}"]}%)"
      done
      echo "   This suggests performance may be affected by warm-up, garbage collection, or external factors."
      echo ""
    fi
    
    echo "### Recommendations"
    echo ""
    echo "1. **For Latency-Sensitive Applications:** Use \`${best_latency_route}\` for optimal response times."
    echo ""
    echo "2. **For Production Stability:** Consider \`${most_consistent_route}\` if predictable performance is critical, even if average latency is slightly higher."
    echo ""
    
    if [ ${#high_variance_routes[@]} -gt 0 ]; then
      echo "3. **Investigate High Variance:** Routes with CV > 50% may benefit from:"
      echo "   - Warm-up periods before accepting traffic"
      echo "   - Memory/CPU tuning"
      echo "   - Connection pooling optimizations"
      echo ""
    fi
    
    echo "4. **Resource Usage:** Monitor memory usage as peak values approach the ${mem_limit_mib}MB container limit. Consider increasing limits if production traffic exceeds test levels."
    echo ""
    
    echo "---"
    echo ""
    echo "## Flame Profile Analysis"
    echo ""
    echo "This section summarizes CPU and heap profiling data from Flame across all runs."
    echo ""
    
    # Collect and aggregate flame profile data
    declare -A cpu_hotspots
    declare -A heap_hotspots
    local cpu_profile_count=0
    local heap_profile_count=0
    
    for run_dir in "${run_dirs[@]}"; do
      # Find CPU profiles in this run
      while IFS= read -r cpu_file; do
        [ -z "${cpu_file}" ] && continue
        local hotspots
        hotspots=$(parse_flame_profile "${cpu_file}" "cpu")
        if [ -n "${hotspots}" ]; then
          cpu_profile_count=$((cpu_profile_count + 1))
          # Parse and count hotspots
          IFS=',' read -ra spots <<< "${hotspots}"
          for spot in "${spots[@]}"; do
            local func="${spot%%:*}"
            local rest="${spot#*:}"
            local self_pct="${rest%%:*}"
            if [ -n "${func}" ] && [ -n "${self_pct}" ]; then
              local current="${cpu_hotspots["${func}"]:-0}"
              cpu_hotspots["${func}"]=$(echo "${current} + ${self_pct}" | bc -l 2>/dev/null || echo "${current}")
            fi
          done
        fi
      done < <(find "${run_dir}" -name "cpu-profile-*.md" 2>/dev/null)
      
      # Find Heap profiles in this run
      while IFS= read -r heap_file; do
        [ -z "${heap_file}" ] && continue
        local hotspots
        hotspots=$(parse_flame_profile "${heap_file}" "heap")
        if [ -n "${hotspots}" ]; then
          heap_profile_count=$((heap_profile_count + 1))
          # Parse and count hotspots
          IFS=',' read -ra spots <<< "${hotspots}"
          for spot in "${spots[@]}"; do
            local func="${spot%%:*}"
            local rest="${spot#*:}"
            local self_pct="${rest%%:*}"
            if [ -n "${func}" ] && [ -n "${self_pct}" ]; then
              local current="${heap_hotspots["${func}"]:-0}"
              heap_hotspots["${func}"]=$(echo "${current} + ${self_pct}" | bc -l 2>/dev/null || echo "${current}")
            fi
          done
        fi
      done < <(find "${run_dir}" -name "heap-profile-*.md" 2>/dev/null)
    done
    
    echo "### CPU Profile Summary"
    echo ""
    echo "**Profiles analyzed:** ${cpu_profile_count}"
    echo ""
    
    if [ ${#cpu_hotspots[@]} -gt 0 ]; then
      echo "| Function | Total Self% (across profiles) | Avg Self% | Concern Level |"
      echo "|----------|-------------------------------|-----------|---------------|"
      
      # Sort and display top CPU hotspots
      local sorted_cpu=()
      for func in "${!cpu_hotspots[@]}"; do
        sorted_cpu+=("${cpu_hotspots["${func}"]}:${func}")
      done
      IFS=$'\n' sorted_cpu=($(sort -t: -k1 -rn <<<"${sorted_cpu[*]}" | head -10)); unset IFS
      
      for entry in "${sorted_cpu[@]}"; do
        local total="${entry%%:*}"
        local func="${entry#*:}"
        local avg=""
        local concern=""
        
        if [ "${cpu_profile_count}" -gt 0 ]; then
          avg=$(echo "scale=1; ${total} / ${cpu_profile_count}" | bc -l 2>/dev/null || echo "N/A")
          
          if (( $(echo "${avg} > 10" | bc -l 2>/dev/null || echo "0") )); then
            concern="High - Optimize"
          elif (( $(echo "${avg} > 5" | bc -l 2>/dev/null || echo "0") )); then
            concern="Medium - Monitor"
          else
            concern="Low"
          fi
        fi
        
        echo "| \`${func}\` | ${total}% | ${avg}% | ${concern} |"
      done
    else
      echo "*No CPU profile data found*"
    fi
    
    echo ""
    echo "### Heap Profile Summary"
    echo ""
    echo "**Profiles analyzed:** ${heap_profile_count}"
    echo ""
    
    if [ ${#heap_hotspots[@]} -gt 0 ]; then
      echo "| Function | Total Self% (across profiles) | Avg Self% | Concern Level |"
      echo "|----------|-------------------------------|-----------|---------------|"
      
      # Sort and display top heap hotspots
      local sorted_heap=()
      for func in "${!heap_hotspots[@]}"; do
        sorted_heap+=("${heap_hotspots["${func}"]}:${func}")
      done
      IFS=$'\n' sorted_heap=($(sort -t: -k1 -rn <<<"${sorted_heap[*]}" | head -10)); unset IFS
      
      for entry in "${sorted_heap[@]}"; do
        local total="${entry%%:*}"
        local func="${entry#*:}"
        local avg=""
        local concern=""
        
        if [ "${heap_profile_count}" -gt 0 ]; then
          avg=$(echo "scale=1; ${total} / ${heap_profile_count}" | bc -l 2>/dev/null || echo "N/A")
          
          if (( $(echo "${avg} > 50" | bc -l 2>/dev/null || echo "0") )); then
            concern="High - Memory hotspot"
          elif (( $(echo "${avg} > 20" | bc -l 2>/dev/null || echo "0") )); then
            concern="Medium - Monitor"
          else
            concern="Low"
          fi
        fi
        
        echo "| \`${func}\` | ${total}% | ${avg}% | ${concern} |"
      done
    else
      echo "*No heap profile data found*"
    fi
    
    echo ""
    echo "### Sample Critical Paths"
    echo ""
    echo "The following are representative critical execution paths from the flame profiles:"
    echo ""
    
    # Get sample critical paths from one profile
    local sample_cpu_profile
    sample_cpu_profile=$(find "${run_dirs[0]}" -name "cpu-profile-*.md" 2>/dev/null | head -1)
    
    if [ -n "${sample_cpu_profile}" ] && [ -f "${sample_cpu_profile}" ]; then
      echo "**CPU Critical Paths (from first run):**"
      echo ""
      grep -E '^[0-9]+\.\s+\*\*\[' "${sample_cpu_profile}" 2>/dev/null | head -3 | while read -r line; do
        echo "${line}"
      done
      echo ""
    fi
    
    local sample_heap_profile
    sample_heap_profile=$(find "${run_dirs[0]}" -name "heap-profile-*.md" 2>/dev/null | head -1)
    
    if [ -n "${sample_heap_profile}" ] && [ -f "${sample_heap_profile}" ]; then
      echo "**Heap Critical Paths (from first run):**"
      echo ""
      grep -E '^[0-9]+\.\s+\*\*\[' "${sample_heap_profile}" 2>/dev/null | head -3 | while read -r line; do
        echo "${line}"
      done
      echo ""
    fi
    
    echo "---"
    echo ""
    echo "## Statistical Notes"
    echo ""
    echo "- **Sample Size:** ${num_runs} runs per route"
    echo "- **Total Requests:** $(awk -F',' 'NR>1 {sum+=$11} END {print sum}' "${csv_file}") across all runs"
    echo "- **Coefficient of Variation (CV):** Standard deviation / mean × 100. Lower is better."
    echo "  - CV < 20%: Excellent consistency"
    echo "  - CV 20-40%: Good consistency"
    echo "  - CV 40-60%: Moderate variability"
    echo "  - CV > 60%: High variability"
    echo ""
    echo "---"
    echo ""
    echo "## Raw Data"
    echo ""
    echo "The complete dataset is available in \`benchmark_data.csv\` for further analysis."
    echo ""
    echo "**CSV Columns:**"
    echo "- run: Run number (1-${num_runs})"
    echo "- route: Route identifier"
    echo "- avg_ms, min_ms, med_ms, max_ms: Latency statistics in milliseconds"
    echo "- p50_ms, p90_ms, p95_ms, p99_ms: Percentile latencies"
    echo "- requests: Total requests completed"
    echo "- throughput: Requests per second"
    echo "- error_rate: Error percentage"
    echo "- avg_cpu, max_cpu: CPU usage percentages"
    echo "- avg_mem, max_mem: Memory usage in MB"
    echo ""
    echo "---"
    echo ""
    echo "## AI Analysis Prompt"
    echo ""
    echo "Use the following prompt with an AI assistant (Claude, ChatGPT, Cursor) for deeper analysis:"
    echo ""
    echo '```'
    echo "I have a k6 benchmark report for a Next.js application with ${num_runs} runs."
    echo "Please analyze the following data and provide insights:"
    echo ""
    echo "### Performance Data Summary"
    echo ""
    echo "**Routes Tested:**"
    for j in "${!routes[@]}"; do
      echo "- ${routes[$j]} (${route_names[$j]}): Avg ${route_avg_latency["${routes[$j]}"]:-N/A}ms, P95 ${route_p95_latency["${routes[$j]}"]:-N/A}ms, CV ${route_cv["${routes[$j]}"]:-N/A}%"
    done
    echo ""
    echo "**Resource Usage:**"
    for j in "${!routes[@]}"; do
      echo "- ${routes[$j]}: CPU avg ${route_avg_cpu["${routes[$j]}"]:-N/A}%, peak ${route_max_cpu["${routes[$j]}"]:-N/A}%, Mem avg ${route_avg_mem["${routes[$j]}"]:-N/A}MB, peak ${route_max_mem["${routes[$j]}"]:-N/A}MB"
    done
    echo ""
    echo "**Flame Profile Hotspots (CPU):**"
    if [ ${#cpu_hotspots[@]} -gt 0 ]; then
      local count=0
      for entry in "${sorted_cpu[@]}"; do
        local total="${entry%%:*}"
        local func="${entry#*:}"
        local avg=""
        if [ "${cpu_profile_count}" -gt 0 ]; then
          avg=$(echo "scale=1; ${total} / ${cpu_profile_count}" | bc -l 2>/dev/null || echo "N/A")
        fi
        echo "- ${func}: ${avg}% avg self-time"
        count=$((count + 1))
        [ "${count}" -ge 5 ] && break
      done
    fi
    echo ""
    echo "**Flame Profile Hotspots (Heap):**"
    if [ ${#heap_hotspots[@]} -gt 0 ]; then
      local count=0
      for entry in "${sorted_heap[@]}"; do
        local total="${entry%%:*}"
        local func="${entry#*:}"
        local avg=""
        if [ "${heap_profile_count}" -gt 0 ]; then
          avg=$(echo "scale=1; ${total} / ${heap_profile_count}" | bc -l 2>/dev/null || echo "N/A")
        fi
        echo "- ${func}: ${avg}% avg allocations"
        count=$((count + 1))
        [ "${count}" -ge 5 ] && break
      done
    fi
    echo ""
    echo "### Questions to Answer"
    echo ""
    echo "1. **Performance Analysis:**"
    echo "   - Why do SSR routes show higher variance (CV 80-100%) vs client SWR routes (CV 20-40%)?"
    echo "   - What explains the performance difference between the routes?"
    echo "   - Are there any concerning patterns in the latency distribution?"
    echo ""
    echo "2. **Resource Optimization:**"
    echo "   - What do the CPU spikes (some >100%) indicate?"
    echo "   - Is memory usage healthy or are there signs of memory pressure?"
    echo "   - Should resource limits be adjusted?"
    echo ""
    echo "3. **Flame Profile Interpretation:**"
    echo "   - What do the top CPU hotspots tell us about optimization opportunities?"
    echo "   - Is the readFileSync dominance in heap profiles normal for Next.js?"
    echo "   - What specific code changes would reduce these hotspots?"
    echo ""
    echo "4. **Recommendations:**"
    echo "   - Which route pattern should be used for production?"
    echo "   - What are the top 3 optimizations to implement?"
    echo "   - Should we add warm-up periods before accepting traffic?"
    echo ""
    echo "Please provide actionable recommendations with specific code or configuration changes."
    echo '```'
    echo ""
    echo "---"
    echo ""
    echo "## Understanding the Flame Profiles"
    echo ""
    echo "### How to Interpret CPU Profiles"
    echo ""
    echo "| Metric | Meaning | Action |"
    echo "|--------|---------|--------|"
    echo "| **Self%** | Time spent directly in this function (not including calls to other functions) | High self% = optimize this specific function |"
    echo "| **Cum%** | Total time including all functions called by this function | High cum% with low self% = look at what it calls |"
    echo "| **Garbage Collection** | Time spent freeing memory | >5% = reduce allocations, use object pooling |"
    echo "| **readFileSync** | Synchronous file I/O | Should be minimal in production; cache results |"
    echo "| **runMicrotasks** | Async operation overhead | High = many small async ops; consider batching |"
    echo ""
    echo "### How to Interpret Heap Profiles"
    echo ""
    echo "| Metric | Meaning | Action |"
    echo "|--------|---------|--------|"
    echo "| **Self%** | Memory allocated directly by this function | High self% = this function creates many objects |"
    echo "| **readFileSync dominating** | File content being loaded into memory | Normal at startup; concerning if per-request |"
    echo "| **Module loading paths** | JavaScript module initialization | Should only happen at startup, not per-request |"
    echo ""
    echo "### Red Flags to Watch For"
    echo ""
    echo "1. **CPU Profile:**"
    echo "   - \`Garbage Collection\` > 5% → Memory pressure"
    echo "   - \`readFileSync\` in hot paths → Missing caching"
    echo "   - RegExp patterns in top spots → Expensive string parsing"
    echo "   - \`JSON.parse\`/\`JSON.stringify\` > 10% → Consider streaming"
    echo ""
    echo "2. **Heap Profile:**"
    echo "   - \`readFileSync\` > 90% → Module loading dominating"
    echo "   - Repeated allocations per request → Object pooling needed"
    echo "   - Large cumulative paths → Memory leaks possible"
    echo ""
    echo "### Optimization Strategies by Hotspot"
    echo ""
    echo "| Hotspot | Likely Cause | Fix |"
    echo "|---------|--------------|-----|"
    echo "| \`urlParse\` | URL parsing per request | Cache parsed URLs |"
    echo "| \`readFileSync\` | File loading per request | Cache file contents |"
    echo "| \`RegExp\` | Locale/string parsing | Pre-compile patterns |"
    echo "| \`handleRequestImpl\` | Request handling overhead | Optimize middleware |"
    echo "| \`writev\`/\`writevGeneric\` | Response writing | Use streaming responses |"
    
  } > "${output_file}"
  
  success "Report generated: ${output_file}"
  info "CSV data: ${csv_file}"
}

main "$@"
