import { check } from "k6";
import exec from "k6/execution";
import http from "k6/http";
import { Rate } from "k6/metrics";
import {
  buildPhaseOptions,
  buildSummary,
  getRequiredEnv,
  loadJsonFile,
} from "./common.js";

const baseUrl = getRequiredEnv("UPLOAD_API_K6_BASE_URL").replace(/\/$/, "");
const citizenBearerToken = getRequiredEnv("UPLOAD_API_K6_CITIZEN_BEARER_TOKEN");
const sharedIdsPath = getRequiredEnv("UPLOAD_API_K6_SHARED_FILE_IDS_PATH");
const summaryPath = getRequiredEnv("UPLOAD_API_K6_DOWNLOAD_SUMMARY_PATH");
const sharedFileIds = loadJsonFile(sharedIdsPath);

if (!Array.isArray(sharedFileIds) || sharedFileIds.length === 0) {
  throw new Error("Shared file IDs file must contain at least one ID");
}

export const download_error_rate = new Rate("download_error_rate");

export const options = buildPhaseOptions({
  scenarioName: "download_phase",
  exec: "downloadPhase",
  stagesEnvName: "UPLOAD_API_K6_DOWNLOAD_STAGES_JSON",
  gracefulRampDownEnvName: "UPLOAD_API_K6_DOWNLOAD_GRACEFUL_RAMP_DOWN",
  errorMetricName: "download_error_rate",
  errorRateThresholdEnvName: "UPLOAD_API_K6_DOWNLOAD_ERROR_RATE_THRESHOLD",
  p95ThresholdEnvName: "UPLOAD_API_K6_DOWNLOAD_P95_MS",
});

export function downloadPhase() {
  const iteration = exec.scenario.iterationInTest ?? 0;
  const fileId = sharedFileIds[iteration % sharedFileIds.length];
  const response = http.get(`${baseUrl}/api/v1/files/${fileId}`, {
    headers: {
      Authorization: `Bearer ${citizenBearerToken}`,
    },
    responseType: "none",
    tags: {
      endpoint: "get_api_v1_files_id",
      phase: "download",
    },
  });

  const isSuccessful = check(response, {
    "download status is 200": (res) => res.status === 200,
  });

  download_error_rate.add(!isSuccessful);
}

export default function defaultPhase() {
  downloadPhase();
}

export function handleSummary(data) {
  return buildSummary({
    data,
    summaryPath,
    phaseName: "download",
    errorMetricName: "download_error_rate",
  });
}
