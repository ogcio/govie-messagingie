import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envFilePath = path.resolve(
    process.env.UPLOAD_API_K6_ENV_FILE ?? path.join(scriptDir, ".env"),
  );

  if (await pathExists(envFilePath)) {
    loadEnv({ path: envFilePath, override: false });
  }

  const config = buildConfig({
    appDir,
    env: process.env,
    envFilePath,
    phaseOverride: args.phase,
  });

  if (args.validateOnly) {
    await validateConfig(config);
    await ensureK6Available();
    console.log(JSON.stringify(buildValidationReport(config), null, 2));
    return;
  }

  await validateConfig(config);
  await ensureK6Available();
  await fs.mkdir(config.artifactsDir, { recursive: true });
  await writeJson(config.paths.manifest, buildManifest(config));

  const context = {
    downloadSummary: null,
    failureMessage: null,
    metadataAfterCount: null,
    metadataBeforeCount: null,
    sharedFileIds: [],
    uploadSummary: null,
    uploadedFileIds: [],
  };

  try {
    console.log(`Using env file: ${envFilePath}`);
    console.log(`Artifacts directory: ${config.artifactsDir}`);
    console.log(`Requested phase: ${config.phase}`);

    if (config.phase === "upload" || config.phase === "all") {
      const publicServantBearerToken = await fetchPublicServantToken(config);

      console.log("Capturing organization metadata before upload phase...");
      const metadataBefore = await fetchOrganizationMetadata(
        config,
        publicServantBearerToken,
      );
      context.metadataBeforeCount = metadataBefore.length;
      await writeJson(config.paths.organizationFilesBefore, metadataBefore);

      console.log("Running upload phase...");
      const uploadPhaseStartedAt = Date.now();
      try {
        await runK6Script({
          extraEnv: {
            UPLOAD_API_K6_BASE_URL: config.baseUrl,
            UPLOAD_API_K6_PUBLIC_SERVANT_BEARER_TOKEN: publicServantBearerToken,
            UPLOAD_API_K6_UPLOAD_ERROR_RATE_THRESHOLD: String(
              config.uploadErrorRateThreshold,
            ),
            UPLOAD_API_K6_UPLOAD_FILE_ABSOLUTE_PATH: config.uploadFilePath,
            UPLOAD_API_K6_UPLOAD_FILE_NAME: config.uploadFileName,
            UPLOAD_API_K6_UPLOAD_GRACEFUL_RAMP_DOWN:
              config.uploadGracefulRampDown,
            UPLOAD_API_K6_UPLOAD_MIME_TYPE: config.uploadMimeType,
            UPLOAD_API_K6_UPLOAD_P95_MS: String(config.uploadP95Ms),
            UPLOAD_API_K6_UPLOAD_STAGES_JSON: config.uploadStagesJson,
            UPLOAD_API_K6_UPLOAD_SUMMARY_PATH: config.paths.uploadSummary,
          },
          scriptPath: path.join(scriptDir, "upload-phase.js"),
          summaryExportPath: config.paths.uploadSummary,
        });
      } catch (error) {
        context.uploadSummary = await readJsonIfExists(
          config.paths.uploadSummary,
        );
        context.failureMessage =
          error instanceof Error ? error.message : String(error);
        throw error;
      }

      context.uploadSummary = await readJson(config.paths.uploadSummary);

      console.log("Resolving newly uploaded file IDs from metadata...");
      const metadataResolution = await waitForNewFiles({
        config,
        metadataBefore,
        publicServantBearerToken,
        uploadPhaseStartedAt,
      });

      context.metadataAfterCount = metadataResolution.organizationFiles.length;
      await writeJson(
        config.paths.organizationFilesAfter,
        metadataResolution.organizationFiles,
      );

      context.uploadedFileIds = uniqueStrings(
        metadataResolution.newFiles
          .map((file) => file.id)
          .filter((fileId) => typeof fileId === "string"),
      );
      await writeJson(config.paths.uploadedFileIds, context.uploadedFileIds);

      if (context.uploadedFileIds.length > 0) {
        console.log(
          `Sharing ${context.uploadedFileIds.length} uploaded file(s)...`,
        );
        context.sharedFileIds = await shareFilesWithCitizen({
          config,
          publicServantBearerToken,
          uploadedFileIds: context.uploadedFileIds,
        });
      }

      await writeJson(config.paths.sharedFileIds, context.sharedFileIds);

      if (config.phase === "all" && context.sharedFileIds.length === 0) {
        throw new Error(
          "Upload phase completed without any shareable file IDs. Download phase cannot start.",
        );
      }
    }

    if (config.phase === "download") {
      context.sharedFileIds = await readFileIds(config.sharedFileIdsPath);
    }

    if (config.phase === "all" || config.phase === "download") {
      if (context.sharedFileIds.length === 0) {
        throw new Error("Download phase requires at least one shared file ID");
      }

      console.log("Fetching impersonated citizen token...");
      const citizenBearerToken = await fetchCitizenAccessToken(config);

      console.log("Running download phase...");
      try {
        await runK6Script({
          extraEnv: {
            UPLOAD_API_K6_BASE_URL: config.baseUrl,
            UPLOAD_API_K6_CITIZEN_BEARER_TOKEN: citizenBearerToken,
            UPLOAD_API_K6_DOWNLOAD_ERROR_RATE_THRESHOLD: String(
              config.downloadErrorRateThreshold,
            ),
            UPLOAD_API_K6_DOWNLOAD_GRACEFUL_RAMP_DOWN:
              config.downloadGracefulRampDown,
            UPLOAD_API_K6_DOWNLOAD_P95_MS: String(config.downloadP95Ms),
            UPLOAD_API_K6_DOWNLOAD_STAGES_JSON: config.downloadStagesJson,
            UPLOAD_API_K6_DOWNLOAD_SUMMARY_PATH: config.paths.downloadSummary,
            UPLOAD_API_K6_SHARED_FILE_IDS_PATH:
              config.phase === "download"
                ? config.sharedFileIdsPath
                : config.paths.sharedFileIds,
          },
          scriptPath: path.join(scriptDir, "download-phase.js"),
          summaryExportPath: config.paths.downloadSummary,
        });
      } catch (error) {
        context.downloadSummary = await readJsonIfExists(
          config.paths.downloadSummary,
        );
        context.failureMessage =
          error instanceof Error ? error.message : String(error);
        throw error;
      }

      context.downloadSummary = await readJson(config.paths.downloadSummary);
    }
  } finally {
    if (context.uploadSummary || context.downloadSummary) {
      try {
        await writeResultsMarkdown(config, context);
      } catch (error) {
        console.error(
          "Failed to write k6 results markdown:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
}

function parseArgs(rawArgs) {
  const parsed = {
    phase: undefined,
    validateOnly: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index];

    if (argument === "--validate") {
      parsed.validateOnly = true;
      continue;
    }

    if (argument === "--phase") {
      parsed.phase = rawArgs[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--phase=")) {
      parsed.phase = argument.split("=", 2)[1];
    }
  }

  return parsed;
}

function buildConfig({
  appDir: currentAppDir,
  env,
  envFilePath,
  phaseOverride,
}) {
  const phase = normalizePhase(
    phaseOverride ?? env.UPLOAD_API_K6_PHASE ?? "all",
  );
  const artifactsDir = resolveFromAppRoot(
    currentAppDir,
    getEnvValueOrFallback(env.UPLOAD_API_K6_ARTIFACTS_DIR, "./k6/artifacts"),
  );
  const uploadFilePath = resolveFromAppRoot(
    currentAppDir,
    getEnvValueOrFallback(
      env.UPLOAD_API_K6_UPLOAD_FILE_PATH,
      "./e2e/LargeFile20mb.pdf",
    ),
  );
  const sharedFileIdsPath = resolveFromAppRoot(
    currentAppDir,
    getEnvValueOrFallback(
      env.UPLOAD_API_K6_SHARED_FILE_IDS_PATH,
      "./k6/artifacts/shared-file-ids.json",
    ),
  );

  return {
    appDir: currentAppDir,
    artifactsDir,
    baseUrl: trimTrailingSlash(env.UPLOAD_API_K6_BASE_URL ?? ""),
    citizenBasicM2MToken: env.BRUNO_CITIZEN_BASIC_M2M_TOKEN ?? "",
    citizenUserId: env.CITIZEN_USER_PROFILE_ID ?? "",
    downloadErrorRateThreshold: parseNumber(
      env.UPLOAD_API_K6_DOWNLOAD_ERROR_RATE_THRESHOLD,
      0.005,
    ),
    downloadGracefulRampDown:
      env.UPLOAD_API_K6_DOWNLOAD_GRACEFUL_RAMP_DOWN ?? "10s",
    downloadP95Ms: parseNumber(env.UPLOAD_API_K6_DOWNLOAD_P95_MS, 10000),
    downloadStagesJson:
      env.UPLOAD_API_K6_DOWNLOAD_STAGES_JSON ??
      '[{"duration":"10s","target":1},{"duration":"20s","target":10},{"duration":"10s","target":0}]',
    envFilePath,
    logtoApiUrl: trimTrailingSlash(env.UPLOAD_API_K6_LOGTO_API_URL ?? ""),
    metadataWaitMs: parseNumber(env.UPLOAD_API_K6_METADATA_WAIT_MS, 5000),
    organizationId: env.UPLOAD_API_K6_ORGANIZATION_ID ?? "",
    phase,
    paths: {
      downloadSummary: path.join(artifactsDir, "download-summary.json"),
      manifest: path.join(artifactsDir, "run-manifest.json"),
      organizationFilesAfter: path.join(
        artifactsDir,
        "organization-files-after.json",
      ),
      organizationFilesBefore: path.join(
        artifactsDir,
        "organization-files-before.json",
      ),
      results: path.join(artifactsDir, "results.md"),
      sharedFileIds: path.join(artifactsDir, "shared-file-ids.json"),
      uploadSummary: path.join(artifactsDir, "upload-summary.json"),
      uploadedFileIds: path.join(artifactsDir, "uploaded-file-ids.json"),
    },
    publicServantBasicToken: env.BRUNO_PS_BASIC_M2M_TOKEN ?? "",
    resourceIndicator:
      env.UPLOAD_API_RESOURCE_INDICATOR ??
      ensureTrailingSlash(trimTrailingSlash(env.UPLOAD_API_K6_BASE_URL ?? "")),
    shareConcurrency: parseNumber(env.UPLOAD_API_K6_SHARE_CONCURRENCY, 10),
    sharedFileIdsPath,
    uploadAppBasicToken: env.BRUNO_BASIC_UPLOAD_APP_TOKEN ?? "",
    uploadAppClientId: env.BRUNO_UPLOAD_APP_ID ?? "",
    uploadErrorRateThreshold: parseNumber(
      env.UPLOAD_API_K6_UPLOAD_ERROR_RATE_THRESHOLD,
      0.01,
    ),
    uploadFileName: path.basename(uploadFilePath),
    uploadFilePath,
    uploadGracefulRampDown:
      env.UPLOAD_API_K6_UPLOAD_GRACEFUL_RAMP_DOWN ?? "10s",
    uploadMimeType: env.UPLOAD_API_K6_UPLOAD_MIME_TYPE ?? "application/pdf",
    uploadP95Ms: parseNumber(env.UPLOAD_API_K6_UPLOAD_P95_MS, 10000),
    uploadStagesJson:
      env.UPLOAD_API_K6_UPLOAD_STAGES_JSON ??
      '[{"duration":"10s","target":1},{"duration":"20s","target":5},{"duration":"10s","target":0}]',
  };
}

async function validateConfig(config) {
  const missing = [];
  const requiresUpload = config.phase === "upload" || config.phase === "all";
  const requiresDownload =
    config.phase === "download" || config.phase === "all";

  requireValue(config.baseUrl, "UPLOAD_API_K6_BASE_URL", missing);
  requireValue(config.logtoApiUrl, "UPLOAD_API_K6_LOGTO_API_URL", missing);
  requireValue(config.organizationId, "UPLOAD_API_K6_ORGANIZATION_ID", missing);
  requireValue(
    config.publicServantBasicToken,
    "BRUNO_PS_BASIC_M2M_TOKEN",
    missing,
  );

  if (requiresDownload) {
    requireValue(
      config.citizenBasicM2MToken,
      "BRUNO_CITIZEN_BASIC_M2M_TOKEN",
      missing,
    );
    requireValue(
      config.uploadAppBasicToken,
      "BRUNO_BASIC_UPLOAD_APP_TOKEN",
      missing,
    );
    requireValue(config.uploadAppClientId, "BRUNO_UPLOAD_APP_ID", missing);
    requireValue(
      config.resourceIndicator,
      "UPLOAD_API_RESOURCE_INDICATOR",
      missing,
    );
    requireValue(config.citizenUserId, "CITIZEN_USER_PROFILE_ID", missing);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  validateStagesJson(
    config.uploadStagesJson,
    "UPLOAD_API_K6_UPLOAD_STAGES_JSON",
  );
  validateStagesJson(
    config.downloadStagesJson,
    "UPLOAD_API_K6_DOWNLOAD_STAGES_JSON",
  );

  if (requiresUpload && !(await pathExists(config.uploadFilePath))) {
    throw new Error(`Upload file not found: ${config.uploadFilePath}`);
  }

  if (
    config.phase === "download" &&
    !(await pathExists(config.sharedFileIdsPath))
  ) {
    throw new Error(
      `Shared file IDs artifact not found: ${config.sharedFileIdsPath}`,
    );
  }

  if (
    config.phase === "download" &&
    (await pathIsDirectory(config.sharedFileIdsPath))
  ) {
    throw new Error(
      `Shared file IDs path must point to a JSON file, got directory: ${config.sharedFileIdsPath}`,
    );
  }
}

function buildValidationReport(config) {
  return {
    artifactsDir: config.artifactsDir,
    baseUrl: config.baseUrl,
    citizenUserId: config.citizenUserId || null,
    envFilePath: config.envFilePath,
    logtoApiUrl: config.logtoApiUrl,
    organizationId: config.organizationId,
    phase: config.phase,
    resourceIndicator: config.resourceIndicator,
    sharedFileIdsPath:
      config.phase === "download"
        ? config.sharedFileIdsPath
        : config.paths.sharedFileIds,
    thresholds: {
      downloadErrorRate: config.downloadErrorRateThreshold,
      downloadP95Ms: config.downloadP95Ms,
      uploadErrorRate: config.uploadErrorRateThreshold,
      uploadP95Ms: config.uploadP95Ms,
    },
    uploadFilePath: config.phase === "download" ? null : config.uploadFilePath,
  };
}

function buildManifest(config) {
  return {
    artifactsDir: config.artifactsDir,
    baseUrl: config.baseUrl,
    citizenUserId: config.citizenUserId || null,
    envFilePath: config.envFilePath,
    generatedAt: new Date().toISOString(),
    logtoApiUrl: config.logtoApiUrl,
    organizationId: config.organizationId,
    phase: config.phase,
    resourceIndicator: config.resourceIndicator,
    sharedFileIdsPath: config.sharedFileIdsPath,
    thresholds: {
      downloadErrorRate: config.downloadErrorRateThreshold,
      downloadP95Ms: config.downloadP95Ms,
      uploadErrorRate: config.uploadErrorRateThreshold,
      uploadP95Ms: config.uploadP95Ms,
    },
    uploadFilePath: config.uploadFilePath,
  };
}

async function fetchPublicServantToken(config) {
  console.log("Fetching Public Servant access token...");
  const response = await postForm(
    `${config.logtoApiUrl}/oidc/token`,
    {
      Authorization: `Basic ${config.publicServantBasicToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    [
      ["grant_type", "client_credentials"],
      ["scope", "upload:file:*"],
      ["organization_id", config.organizationId],
    ],
    "Public Servant token",
  );

  return response.access_token;
}

async function fetchCitizenAccessToken(config) {
  console.log("Fetching Logto management access token...");
  const managementToken = await postForm(
    `${config.logtoApiUrl}/oidc/token`,
    {
      Authorization: `Basic ${config.citizenBasicM2MToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    [
      ["grant_type", "client_credentials"],
      ["scope", "all"],
      ["resource", "https://default.logto.app/api"],
    ],
    "management token",
  );

  console.log("Fetching Logto subject token...");
  const subjectToken = await postJson(
    `${config.logtoApiUrl}/api/subject-tokens`,
    {
      Authorization: `Bearer ${managementToken.access_token}`,
      "Content-Type": "application/json",
    },
    { userId: config.citizenUserId },
    "subject token",
    201,
  );

  console.log("Fetching impersonated citizen access token...");
  const citizenToken = await postForm(
    `${config.logtoApiUrl}/oidc/token`,
    {
      Authorization: `Basic ${config.uploadAppBasicToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    [
      ["grant_type", "urn:ietf:params:oauth:grant-type:token-exchange"],
      ["scope", "upload:file.self:read"],
      ["organization_id", config.organizationId],
      ["resource", config.resourceIndicator],
      ["client_id", config.uploadAppClientId],
      ["subject_token", subjectToken.subjectToken],
      ["subject_token_type", "urn:ietf:params:oauth:token-type:access_token"],
    ],
    "impersonated citizen token",
  );

  return citizenToken.access_token;
}

async function fetchOrganizationMetadata(config, bearerToken) {
  const metadataUrl = new URL(
    "/api/v1/metadata",
    ensureTrailingSlash(config.baseUrl),
  );
  metadataUrl.searchParams.set("organizationId", config.organizationId);

  const response = await fetch(metadataUrl, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  const body = await parseJsonResponse(response, "organization metadata");
  return Array.isArray(body.data) ? body.data : [];
}

async function waitForNewFiles({
  config,
  metadataBefore,
  publicServantBearerToken,
  uploadPhaseStartedAt,
}) {
  const baselineIds = new Set(
    metadataBefore
      .map((file) => file.id)
      .filter((fileId) => typeof fileId === "string"),
  );
  const deadline = Date.now() + config.metadataWaitMs;
  let organizationFiles = [];
  let newFiles = [];

  for (;;) {
    organizationFiles = await fetchOrganizationMetadata(
      config,
      publicServantBearerToken,
    );
    newFiles = organizationFiles.filter((file) =>
      isFileCreatedByRun({
        baselineIds,
        file,
        startedAt: uploadPhaseStartedAt,
        uploadFileName: config.uploadFileName,
      }),
    );

    if (newFiles.length > 0 || Date.now() >= deadline) {
      return { newFiles, organizationFiles };
    }

    await delay(500);
  }
}

function isFileCreatedByRun({ baselineIds, file, _startedAt, uploadFileName }) {
  if (!file || typeof file.id !== "string") {
    return false;
  }

  if (baselineIds.has(file.id)) {
    return false;
  }

  if (!matchesUploadedFilename(file.fileName, uploadFileName)) {
    return false;
  }

  return true;
}

function matchesUploadedFilename(fileName, uploadFileName) {
  if (typeof fileName !== "string" || fileName.length === 0) {
    return false;
  }

  if (fileName === uploadFileName) {
    return true;
  }

  const extensionIndex = uploadFileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return fileName.startsWith(`${uploadFileName}-`);
  }

  const baseName = uploadFileName.slice(0, extensionIndex);
  const extension = uploadFileName.slice(extensionIndex);

  return fileName.startsWith(`${baseName}-`) && fileName.endsWith(extension);
}

async function shareFilesWithCitizen({
  config,
  publicServantBearerToken,
  uploadedFileIds,
}) {
  const sharedIds = await mapWithConcurrency(
    uploadedFileIds,
    Math.max(1, Math.floor(config.shareConcurrency)),
    async (fileId) => {
      await postJson(
        `${config.baseUrl}/api/v1/permissions`,
        {
          Authorization: `Bearer ${publicServantBearerToken}`,
          "Content-Type": "application/json",
        },
        {
          fileId,
          userId: config.citizenUserId,
        },
        `share file ${fileId}`,
        201,
      );

      return fileId;
    },
  );

  return uniqueStrings(sharedIds);
}

async function runK6Script({ extraEnv, scriptPath, summaryExportPath }) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      "k6",
      ["run", `--summary-export=${summaryExportPath}`, scriptPath],
      {
        env: {
          ...process.env,
          ...extraEnv,
          K6_NO_USAGE_REPORT: "true",
        },
        stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`k6 exited with status ${code}`));
    });
  });
}

async function ensureK6Available() {
  await new Promise((resolve, reject) => {
    const child = spawn("k6", ["version"], {
      stdio: "ignore",
    });

    child.once("error", () => {
      reject(new Error("k6 is not available in PATH"));
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error("k6 is installed but `k6 version` failed"));
    });
  });
}

async function postForm(url, headers, pairs, description) {
  const body = new URLSearchParams();

  for (const [key, value] of pairs) {
    body.append(key, value);
  }

  const response = await fetch(url, {
    body,
    headers,
    method: "POST",
  });

  return parseJsonResponse(response, description);
}

async function postJson(url, headers, body, description, expectedStatus = 200) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });

  const responseText = await response.text();

  if (response.status !== expectedStatus) {
    throw new Error(
      `${description} request failed with status ${response.status}: ${responseText}`,
    );
  }

  return responseText ? JSON.parse(responseText) : {};
}

async function parseJsonResponse(response, description) {
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `${description} request failed with status ${response.status}: ${responseText}`,
    );
  }

  return responseText ? JSON.parse(responseText) : {};
}

async function writeResultsMarkdown(config, context) {
  const lines = [
    "# Upload API load test results",
    "",
    `Phase: ${config.phase}`,
    `Artifacts directory: ${path.relative(config.appDir, config.artifactsDir)}`,
  ];

  if (context.failureMessage) {
    lines.push(`Failure: ${context.failureMessage}`);
  }

  if (config.phase !== "download") {
    lines.push(
      `Upload file: ${path.relative(config.appDir, config.uploadFilePath)}`,
    );
  }

  lines.push("");

  if (context.uploadSummary) {
    lines.push("## Upload phase");
    lines.push(
      ...renderPhaseSummary({
        errorMetricName: "upload_error_rate",
        errorRateThreshold: config.uploadErrorRateThreshold,
        p95ThresholdMs: config.uploadP95Ms,
        summary: context.uploadSummary,
      }),
    );
    lines.push(`New file IDs discovered: ${context.uploadedFileIds.length}`);
    lines.push(`Shared file IDs prepared: ${context.sharedFileIds.length}`);

    if (context.metadataBeforeCount !== null) {
      lines.push(
        `Organization files before upload: ${context.metadataBeforeCount}`,
      );
    }

    if (context.metadataAfterCount !== null) {
      lines.push(
        `Organization files after upload: ${context.metadataAfterCount}`,
      );
    }

    lines.push("");
  }

  if (context.downloadSummary) {
    lines.push("## Download phase");
    lines.push(
      ...renderPhaseSummary({
        errorMetricName: "download_error_rate",
        errorRateThreshold: config.downloadErrorRateThreshold,
        p95ThresholdMs: config.downloadP95Ms,
        summary: context.downloadSummary,
      }),
    );
    lines.push(`Shared file IDs consumed: ${context.sharedFileIds.length}`);
    lines.push("");
  }

  await fs.writeFile(config.paths.results, `${lines.join("\n")}\n`, "utf8");
}

function renderPhaseSummary({
  errorMetricName,
  errorRateThreshold,
  p95ThresholdMs,
  summary,
}) {
  const metrics = summary.metrics ?? {};
  const httpRequests = getMetricValues(metrics.http_reqs);
  const iterations = getMetricValues(metrics.iterations);
  const durations = getMetricValues(metrics.http_req_duration);
  const errors = getMetricValues(metrics[errorMetricName]);
  const maxVus = getMetricValues(metrics.vus_max);
  const actualErrorRate = valueOrNull(errors.rate ?? errors.value);
  const actualP95 = valueOrNull(durations["p(95)"]);

  return [
    `Requests: ${formatNumber(httpRequests.count)}`,
    `Iterations: ${formatNumber(iterations.count)}`,
    `Throughput: ${formatRate(httpRequests.rate)}`,
    `Error rate: ${formatPercent(actualErrorRate)} (${compareThreshold(actualErrorRate, errorRateThreshold, true)})`,
    `p95 duration: ${formatDuration(actualP95)} (${compareThreshold(actualP95, p95ThresholdMs, false)})`,
    `Average duration: ${formatDuration(durations.avg)}`,
    `Max VUs: ${formatNumber(maxVus.value ?? maxVus.max)}`,
  ];
}

function getMetricValues(metric) {
  if (!metric || typeof metric !== "object") {
    return {};
  }

  return metric.values ?? metric;
}

function compareThreshold(actual, threshold, isRate) {
  if (actual === null) {
    return `threshold <= ${isRate ? formatPercent(threshold) : formatDuration(threshold)}`;
  }

  const passed = actual <= threshold;
  return `${passed ? "within" : "above"} threshold <= ${
    isRate ? formatPercent(threshold) : formatDuration(threshold)
  }`;
}

async function readFileIds(filePath) {
  const fileIds = await readJson(filePath);

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new Error(`No file IDs found in ${filePath}`);
  }

  return fileIds;
}

function normalizePhase(phase) {
  if (phase === "upload" || phase === "download" || phase === "all") {
    return phase;
  }

  throw new Error(`Unsupported phase: ${phase}`);
}

function validateStagesJson(stagesJson, name) {
  const stages = JSON.parse(stagesJson);

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
}

function resolveFromAppRoot(currentAppDir, candidatePath) {
  if (path.isAbsolute(candidatePath)) {
    return candidatePath;
  }

  return path.resolve(currentAppDir, candidatePath);
}

function getEnvValueOrFallback(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim() === "" ? fallback : value;
}

function requireValue(value, name, missing) {
  if (!value) {
    missing.push(name);
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function parseNumber(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`Expected numeric value, received: ${value}`);
  }

  return parsed;
}

async function pathExists(candidatePath) {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function pathIsDirectory(candidatePath) {
  try {
    const stats = await fs.stat(candidatePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }

  return readJson(filePath);
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string"))];
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length || 1)) },
    async () => {
      for (;;) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    },
  );

  await Promise.all(workers);

  return results;
}

function delay(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
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

function valueOrNull(value) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}
