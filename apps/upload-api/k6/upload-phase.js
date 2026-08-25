import { check } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";
import { buildPhaseOptions, buildSummary, getRequiredEnv } from "./common.js";

const baseUrl = getRequiredEnv("UPLOAD_API_K6_BASE_URL").replace(/\/$/, "");
const publicServantBearerToken = getRequiredEnv(
  "UPLOAD_API_K6_PUBLIC_SERVANT_BEARER_TOKEN",
);
const uploadFilePath = getRequiredEnv(
  "UPLOAD_API_K6_UPLOAD_FILE_ABSOLUTE_PATH",
);
const uploadFileName = getRequiredEnv("UPLOAD_API_K6_UPLOAD_FILE_NAME");
const uploadFileMimeType = getRequiredEnv("UPLOAD_API_K6_UPLOAD_MIME_TYPE");
const summaryPath = getRequiredEnv("UPLOAD_API_K6_UPLOAD_SUMMARY_PATH");
const uploadBinary = open(uploadFilePath, "b");

export const upload_error_rate = new Rate("upload_error_rate");

export const options = buildPhaseOptions({
  scenarioName: "upload_phase",
  exec: "uploadPhase",
  stagesEnvName: "UPLOAD_API_K6_UPLOAD_STAGES_JSON",
  gracefulRampDownEnvName: "UPLOAD_API_K6_UPLOAD_GRACEFUL_RAMP_DOWN",
  errorMetricName: "upload_error_rate",
  errorRateThresholdEnvName: "UPLOAD_API_K6_UPLOAD_ERROR_RATE_THRESHOLD",
  p95ThresholdEnvName: "UPLOAD_API_K6_UPLOAD_P95_MS",
});

export function uploadPhase() {
  const response = http.post(
    `${baseUrl}/api/v1/files`,
    {
      file: http.file(uploadBinary, uploadFileName, uploadFileMimeType),
    },
    {
      headers: {
        Authorization: `Bearer ${publicServantBearerToken}`,
      },
      tags: {
        endpoint: "post_api_v1_files",
        phase: "upload",
      },
    },
  );

  let hasFileId = false;

  if (response.status === 201) {
    try {
      hasFileId = Boolean(response.json("data.id"));
    } catch {
      hasFileId = false;
    }
  }

  const isSuccessful = check(response, {
    "upload status is 201": (res) => res.status === 201,
  });

  upload_error_rate.add(!(isSuccessful && hasFileId));
}

export default function defaultPhase() {
  uploadPhase();
}

export function handleSummary(data) {
  return buildSummary({
    data,
    summaryPath,
    phaseName: "upload",
    errorMetricName: "upload_error_rate",
  });
}
