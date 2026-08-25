import { beforeEach, describe, expect, it, vi } from "vitest";
import getDbVersion, {
  type NodeCacheLike,
} from "../../../../routes/files/utils/getDbVersion.js";
import type { ClamavClient } from "../../../../utils/clamav/index.js";

const clamAvVersion = "ClamAV 1.2.3/27364/Sun Aug 11 08:37:34 2024\n";

function createNodeCache(): NodeCacheLike & { values: Map<string, unknown> } {
  return {
    values: new Map<string, unknown>(),
    get(key: string) {
      return this.values.get(key);
    },
    set(key: string, value: unknown) {
      this.values.set(key, value);
      return true;
    },
  };
}

describe("getDbVersion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should reuse the cached antivirus db version", async () => {
    const nodeCache = createNodeCache();
    const nodeClam = {
      getVersion: vi.fn().mockResolvedValue(clamAvVersion),
    } as unknown as ClamavClient;

    const firstVersion = await getDbVersion(nodeClam, nodeCache);
    const secondVersion = await getDbVersion(nodeClam, nodeCache);

    expect(firstVersion).toBe("27364");
    expect(secondVersion).toBe("27364");
    expect(nodeClam.getVersion).toHaveBeenCalledTimes(1);
  });

  it("should dedupe in-flight antivirus db version lookups", async () => {
    let resolveVersion: ((value: string) => void) | undefined;
    const nodeClam = {
      getVersion: vi.fn().mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveVersion = resolve;
          }),
      ),
    } as unknown as ClamavClient;

    const firstLookup = getDbVersion(nodeClam);
    const secondLookup = getDbVersion(nodeClam);

    expect(nodeClam.getVersion).toHaveBeenCalledTimes(1);

    resolveVersion?.(clamAvVersion);

    await expect(firstLookup).resolves.toBe("27364");
    await expect(secondLookup).resolves.toBe("27364");
  });
});
