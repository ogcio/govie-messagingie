import { describe, expect, it, vi } from "vitest";
import { ClamavClient } from "../../../utils/clamav/client.js";
import { ClamavPassthrough } from "../../../utils/clamav/passthrough.js";

const getVersionMock = vi.fn();
vi.mock("../../../utils/clamav/getVersion.js", () => ({
  getVersion: (...args: unknown[]) => getVersionMock(...args),
}));

describe("ClamavClient", () => {
  const options = { host: "127.0.0.1", port: 3310 };

  it("creates a passthrough with the client options", () => {
    const client = new ClamavClient(options);
    const passthrough = client.passthrough({ emitReadable: false });
    expect(passthrough).toBeInstanceOf(ClamavPassthrough);
    passthrough.destroy();
  });

  it("delegates getVersion to the shared options", async () => {
    getVersionMock.mockResolvedValue("ClamAV 1.3.0");
    const client = new ClamavClient(options);
    await expect(client.getVersion()).resolves.toBe("ClamAV 1.3.0");
    expect(getVersionMock).toHaveBeenCalledWith(options);
  });
});
