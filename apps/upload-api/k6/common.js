/* eslint-disable no-undef */
function getRequiredEnv(name) {
  const value = __ENV[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getNumberEnv(name, fallback) {
  const rawValue = __ENV[name];

  if (rawValue === undefined || rawValue === "") {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be numeric`);
  }

  return parsed;
}

function getStages(name) {
  const stages = JSON.parse(getRequiredEnv(name));

  if (!Array.isArray(stages) || stages.length === 0) {
    throw new Error(`${name} must be a non-empty JSON array`);
  }

  for (const stage of stages) {
    if (
      typeof stage !== "object" ||
      stage === null ||
      typeof stage.duration !== "string" ||
      typeof stage.target !== "number"
    ) {
      throw new Error(`${name} must contain objects with duration and target`);
    }
  }

  return stages;
}

function buildPhaseOptions({
  scenarioName,
  exec,
  stagesEnvName,
  gracefulRampDownEnvName,
  errorMetricName,
  errorRateThresholdEnvName,
  p95ThresholdEnvName,
}) {
  const errorThreshold = getNumberEnv(errorRateThresholdEnvName, 0);
  const p95Threshold = getNumberEnv(p95ThresholdEnvName, 10000);

  return {
    scenarios: {
      [scenarioName]: {
        executor: "ramping-vus",
        exec,
        stages: getStages(stagesEnvName),
        gracefulRampDown: getRequiredEnv(gracefulRampDownEnvName),
      },
    },
    thresholds: {
      [errorMetricName]: [`rate<=${errorThreshold}`],
      http_req_duration: [`p(95)<=${p95Threshold}`],
    },
  };
}

function buildSummary({ data, summaryPath, phaseName, errorMetricName }) {
  const duration = data.metrics.http_req_duration?.values ?? {};
  const errors = data.metrics[errorMetricName]?.values ?? {};
  const requests = data.metrics.http_reqs?.values ?? {};
  const iterations = data.metrics.iterations?.values ?? {};
  const maxVus = data.metrics.vus_max?.values?.value;

  const lines = [
    `${phaseName} phase`,
    `requests: ${formatNumber(requests.count)}`,
    `iterations: ${formatNumber(iterations.count)}`,
    `throughput: ${formatRate(requests.rate)}`,
    `error rate: ${formatPercent(errors.rate)}`,
    `p95 duration: ${formatDuration(duration["p(95)"])}`,
    `avg duration: ${formatDuration(duration.avg)}`,
    `max vus: ${formatNumber(maxVus)}`,
  ];

  return {
    stdout: `${lines.join("\n")}\n`,
    [summaryPath]: JSON.stringify(data, null, 2),
  };
}

function loadJsonFile(path) {
  return JSON.parse(open(path));
}

function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
}

function formatRate(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value.toFixed(2)} req/s`;
}

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  return `${(value * 100).toFixed(2)}%`;
}

function formatDuration(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value.toFixed(2)} ms`;
}

export { buildPhaseOptions, buildSummary, getRequiredEnv, loadJsonFile };
