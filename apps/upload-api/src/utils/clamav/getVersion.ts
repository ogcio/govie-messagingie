import { Socket } from "node:net";
import type { ClamavConnectionOptions } from "./types.js";

const VERSION_COMMAND = Buffer.from("zVERSION\0");
const DEFAULT_CONNECTION_TIMEOUT = 5_000;

export async function getVersion(
  options: ClamavConnectionOptions,
): Promise<string> {
  const {
    host,
    port,
    connectionTimeout = DEFAULT_CONNECTION_TIMEOUT,
  } = options;

  return new Promise<string>((resolve, reject) => {
    const socket = new Socket();
    let response = "";

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Connection timeout"));
    }, connectionTimeout);

    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    socket.connect(port, host, () => {
      clearTimeout(timer);

      socket.on("data", (data) => {
        response += data.toString();
      });

      socket.on("end", () => {
        socket.end();
      });

      socket.on("close", () => {
        const trimmed = response.replace(/\0/g, "").trim();
        if (trimmed) {
          resolve(trimmed);
        } else {
          reject(new Error("Empty response from ClamAV"));
        }
      });

      socket.write(VERSION_COMMAND, (err) => {
        if (err) {
          reject(err);
        }
      });
    });
  });
}
