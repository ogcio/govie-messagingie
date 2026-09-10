/**
 * Unit tests for getVersion against an in-process mock TCP server.
 * No docker/clamav container required.
 */
import { Server, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { getVersion } from "../../../utils/clamav/getVersion.js";

describe("getVersion (mock clamd)", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server?.close(resolve));
      server = undefined;
    }
  });

  const startServer = async (
    onConnection: (socket: Socket) => void,
  ): Promise<{ host: string; port: number }> => {
    server = new Server(onConnection);
    const port = await new Promise<number>((resolve, reject) => {
      server?.listen(0, "127.0.0.1", () => {
        const addr = server?.address();
        if (addr && typeof addr === "object") resolve(addr.port);
        else reject(new Error("no address"));
      });
    });
    return { host: "127.0.0.1", port };
  };

  it("resolves with the trimmed version string", async () => {
    const opts = await startServer((socket) => {
      socket.on("data", (data) => {
        expect(data.toString()).toBe("zVERSION\0");
        socket.write("ClamAV 1.3.0/27200/Mon Jan 1 08:00:00 2024\0", () =>
          socket.end(),
        );
      });
    });

    await expect(getVersion(opts)).resolves.toBe(
      "ClamAV 1.3.0/27200/Mon Jan 1 08:00:00 2024",
    );
  });

  it("rejects on an empty response", async () => {
    const opts = await startServer((socket) => {
      socket.on("data", () => socket.end());
    });

    await expect(getVersion(opts)).rejects.toThrow(
      "Empty response from ClamAV",
    );
  });

  it("rejects on connection refused", async () => {
    // Grab a free port, then close the server so the connection is refused.
    const opts = await startServer(() => {});
    const saved = server;
    server = undefined;
    await new Promise((resolve) => saved?.close(resolve));

    await expect(getVersion(opts)).rejects.toThrow();
  });

  it("rejects on connection timeout", async () => {
    // 192.0.2.0/24 (TEST-NET-1) is reserved and unroutable.
    await expect(
      getVersion({ host: "192.0.2.1", port: 3310, connectionTimeout: 50 }),
    ).rejects.toThrow("Connection timeout");
  });
});
