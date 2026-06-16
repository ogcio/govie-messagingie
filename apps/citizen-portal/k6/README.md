# K6 Performance Tests

## Prerequisites

- Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- Ensure you have `gnuplot` installed to be able to generate charts

## Available Tests

| Script | Command | Description |
|--------|---------|-------------|
| Baseline | `pnpm test:k6:baseline` | Low-load baseline (10–50 VUs, 30s each) |
| Load Test | `pnpm test:k6:load` | Progressive load (10→200 VUs, ~11 min) |
| Comparison | `pnpm test:k6:compare` | Compare at 10/50/100 VUs (~4 min) |
| Single Route | `pnpm test:k6:route:messages` | Messages route in isolation (~4 min) |
| All | `pnpm test:k6:all` | Baseline + load test sequentially |

All tests target the `/en/messages` route.

## How to (Host)

1. Start the server
2. Find the server PID
3. Just before running k6 tests, enter the messaging-next folder and run

```bash
top -pid {your-pid} -l 0 -s 1 -stats pid,cpu,mem,rsize > top.raw
```

4. Run a k6 test, e.g.

```bash
pnpm test:k6:route:messages
```

5. Once the k6 script finishes, stop the top command manually.
   You should now have a `top.raw` file in the folder where you ran the script.

6. Extract the data into a tabular format:

```bash
awk '$1 == {yourPid} {
  r=$4            
  if (r ~ /G/) r=substr(r,1,length(r)-1)*1024*1024*1024
  else if (r ~ /M/) r=substr(r,1,length(r)-1)*1024*1024
  else if (r ~ /K/) r=substr(r,1,length(r)-1)*1024
  t++
  print t, $2, r
}
' top.raw > metrics.dat
```

7. Enter gnuplot running `gnuplot`
8. Run inside gnuplot:

```bash
set terminal pngcairo size 1200,600
set output "cpu_mem.png"

set title "Node.js resource usage during k6 test"
set xlabel "Time (seconds)"
set ylabel "CPU (%)"
set y2label "Memory (MB)"
set y2tics
set grid

plot \
  "metrics.dat" using 1:2 axes x1y1 with lines title "CPU %", \
  "metrics.dat" using 1:($3/1024/1024) axes x1y2 with lines title "RSS (MB)"
```

## How to (Docker)

### Benchmark Suite (Multiple Runs for Statistical Analysis)

For statistically significant results, run the benchmark suite multiple times:

1. **Run the benchmark suite:**

   ```bash
   cd apps/messaging-next/k6
   ./run_benchmark_suite.sh 10  # Run 10 iterations (default)
   ```

   This will:
   - Execute the full test suite 10 times
   - Create a `benchmark-YYYYMMDD-HHMMSS` directory containing all runs
   - Wait 30 seconds between runs to let the system stabilize

2. **Analyze the results:**

   ```bash
   ./analyze_benchmark.sh benchmark-YYYYMMDD-HHMMSS
   ```

   This generates:
   - **`BENCHMARK_SUMMARY.md`** - Comprehensive statistical analysis including:
     - Average metrics across all runs
     - Variance analysis (std dev, coefficient of variation)
     - Outlier detection
     - Run-by-run comparison
   - **`benchmark_data.csv`** - Raw data for further analysis

3. **Estimated time:**
   - Each iteration takes ~5 minutes (1 route x ~3.5 min + 30s pause)
   - 10 iterations ~ 50 minutes total

### Automated Testing with Resource Monitoring

The easiest way to run tests with Docker resource monitoring is using the automated script:

1. **Prerequisites:**
   - Docker installed and running
   - `gnuplot` installed (for generating charts)
   - `curl` installed (for health checks)
   - Container image built: `pnpm docker:build`

2. **Run the test:**

   ```bash
   cd apps/messaging-next/k6
   chmod +x run_all_routes_with_stats.sh  # First time only
   ./run_all_routes_with_stats.sh
   ```

   The script will:
   - Create a timestamped output directory (e.g., `run-20260127-165456/`)
   - Start a Docker container with flame profiling
   - Run the k6 load test for the messages route
   - Collect Docker container stats (CPU, memory) every 5 seconds
   - Generate PNG charts showing resource usage over time
   - Stop the container

3. **View the results:**

   After the script completes, navigate to the output directory:

   ```bash
   cd apps/messaging-next/k6/run-YYYYMMDD-HHMMSS
   ```

   You'll find:
   - **`k6-messages-{timestamp}.log`** - Full k6 test output
   - **`docker-stats-messages-{timestamp}.png`** - CPU and memory usage chart
   - **`docker-stats-messages-{timestamp}.dat`** - Raw data (sample, CPU%, memory MiB, normalized percentages)
   - **`docker-stats-messages-{timestamp}.raw`** - Raw Docker stats output

4. **Generating a comparison report:**

   You can use an AI assistant to analyze the k6 log files:

   ```
   Look at the result files in apps/messaging-next/k6/run-YYYYMMDD-HHMMSS/
   and write a summary markdown file with performance analysis.

   Extract metrics including:
   - Requests, req/s, error rate, avg latency, p95 latency
   - Latency distribution (p50, p90, p95, p99, max)
   - SLA compliance status
   - Throughput and VU behavior
   - Resource usage analysis (reference the PNG files)
   ```

5. **Manual testing:**

   ```bash
   # Start the container
   pnpm docker:start:flame

   # In another terminal, run the test
   pnpm test:k6:route:messages

   # Stop the container when done
   docker stop <container-name>
   ```

6. **Configuration:**

   You can override default resource limits via environment variables:

   ```bash
   CPU_LIMIT_CORES=1.25 \
   MEM_LIMIT_MIB=1024 \
   ./run_all_routes_with_stats.sh
   ```

### Test Scenarios

Each test runs three load stages:
- **Light load**: 10 VUs for 1 minute
- **Medium load**: 50 VUs for 1 minute
- **Peak load**: 100 VUs for 1 minute

Total duration per test: ~3-4 minutes

### Resource Limits

Tests run with Docker resource constraints for flame profiling:
- **CPU**: 1.25 cores (1250m) - allows profiling overhead
- **Memory**: 1Gi limit, 256Mi reservation

> **Note:** These limits are higher than typical production limits (0.25 cores, 512Mi)
> to allow for flame profiling overhead. For production-like testing, override with:
> ```bash
> CPU_LIMIT_CORES=0.25 MEM_LIMIT_MIB=512 ./run_all_routes_with_stats.sh
> ```

The generated charts show both absolute values and percentages relative to these limits.

### Analyzing CPU and Memory Profiles with AI

The automated test script generates CPU and heap (memory) profiles in markdown format. You can use an AI assistant to analyze these profiles.

#### Profile Files

After running tests, you'll find these profile files in the output directory:
- **`cpu-profile-{timestamp}.md`** - CPU profiling data showing where time is spent
- **`heap-profile-{timestamp}.md`** - Memory allocation data showing what's consuming memory

#### How to Analyze Profiles

1. **Open the profile files** in your IDE or attach them to your AI assistant.

2. **Ask targeted questions** about performance:

   ```
   What are the top 3 things I should optimize?
   ```

   ```
   How can I reduce the time spent in renderTemplate?
   ```

   ```
   Look CAREFULLY at the markdown results in apps/messaging-next/k6/run-YYYYMMDD-HHMMSS/
   Cross-reference them with the k6 results in the .log files.
   Create a comparison report answering:
   - What are the top 3 things I should optimize?
   - Is this JSON parsing overhead normal?
   - Improve the performance of all the hotspots.
   ```

#### Understanding Profile Data

**CPU Profile Key Metrics:**
- **Self%** - Time spent directly in that function (not including calls to other functions)
- **Cum%** - Cumulative time including all functions called by this function
- **Critical Paths** - The most expensive call chains in your application

**Heap Profile Key Metrics:**
- **Self%** - Memory allocated directly by that function
- **Cum%** - Total memory including allocations by called functions
- **Objects (count)** - Number of objects allocated

#### What to Look For

**Red flags in CPU profiles:**
- High cumulative time (>50%) in `readFileSync` or dynamic imports
- Excessive time in `Garbage Collection` (>5%)
- RegExp patterns in critical paths (often indicates locale/string parsing)
- `runMicrotasks` with high cumulative time (indicates async overhead)

**Red flags in heap profiles:**
- `readFileSync` dominating allocations (>50%)
- Module loading paths with high cumulative percentages
- Repeated patterns in critical paths (indicates per-request allocations)
