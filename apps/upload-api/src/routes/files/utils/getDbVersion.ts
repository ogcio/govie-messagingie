import type { ClamavClient } from "../../../utils/clamav/index.js";

const ANTIVIRUS_DB_VERSION_CACHE_KEY = "antivirus_db_version";
const ANTIVIRUS_DB_VERSION_TTL_SECONDS = 60;
// Shares one pending clamd version lookup per client while the TTL cache is cold.
const inFlightVersionLookups = new WeakMap<ClamavClient, Promise<string>>();

export type NodeCacheLike = {
  get(key: string): unknown;
  set(key: string, value: unknown, ttl?: number): boolean;
};

async function loadDbVersion(client: ClamavClient): Promise<string> {
  const version = await client.getVersion();
  return version.match(/\/(\d+)\//)?.[1] || "unknown";
}

export default async (client: ClamavClient, nodeCache?: NodeCacheLike) => {
  const cachedVersion = nodeCache?.get(ANTIVIRUS_DB_VERSION_CACHE_KEY);
  if (typeof cachedVersion === "string") {
    return cachedVersion;
  }

  let inFlightLookup = inFlightVersionLookups.get(client);
  if (!inFlightLookup) {
    inFlightLookup = loadDbVersion(client).finally(() => {
      inFlightVersionLookups.delete(client);
    });
    inFlightVersionLookups.set(client, inFlightLookup);
  }

  const antivirusDbVersion = await inFlightLookup;
  nodeCache?.set(
    ANTIVIRUS_DB_VERSION_CACHE_KEY,
    antivirusDbVersion,
    ANTIVIRUS_DB_VERSION_TTL_SECONDS,
  );

  return antivirusDbVersion;
};
