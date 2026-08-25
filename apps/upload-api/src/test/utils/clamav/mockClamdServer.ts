import { Server, type Socket } from "node:net";

export type MockClamdBehavior =
  | { type: "ok" }
  | { type: "found"; virus: string }
  | { type: "error"; message: string }
  | { type: "timeout" } // Never responds
  | { type: "disconnect" } // Abrupt close mid-stream
  | { type: "custom"; response: string };

export type MockClamdServerOptions = {
  behavior: MockClamdBehavior;
  /** Delay in ms before sending response (simulates slow scan). Default: 0 */
  responseDelay?: number;
};

export type ChunkRecord = {
  length: number;
  data: Buffer;
};

/**
 * A minimal mock ClamAV daemon TCP server for testing.
 * Validates the INSTREAM protocol and responds based on configured behavior.
 */
export class MockClamdServer {
  private server: Server;
  private options: MockClamdServerOptions;

  /** Chunks received from the client (excluding protocol framing). */
  public receivedChunks: ChunkRecord[] = [];
  /** Whether the INSTREAM command was received correctly. */
  public commandReceived = false;
  /** The port the server is listening on (available after start()). */
  public port = 0;
  private connections: Set<Socket> = new Set();

  constructor(options: MockClamdServerOptions) {
    this.options = options;
    this.server = new Server((socket) => this.handleConnection(socket));
  }

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server.address();
        if (addr && typeof addr === "object") {
          this.port = addr.port;
          resolve(this.port);
        } else {
          reject(new Error("Failed to get server address"));
        }
      });
      this.server.once("error", reject);
    });
  }

  async stop(): Promise<void> {
    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections.clear();
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  private handleConnection(socket: Socket): void {
    this.connections.add(socket);
    socket.on("close", () => this.connections.delete(socket));
    let buffer = Buffer.alloc(0);
    let gotCommand = false;
    let terminated = false;

    socket.on("data", (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);

      if (!gotCommand) {
        const nullIndex = buffer.indexOf(0x00);
        if (nullIndex === -1) return;

        const command = buffer.subarray(0, nullIndex).toString();
        if (command === "zINSTREAM") {
          this.commandReceived = true;
          gotCommand = true;
          buffer = buffer.subarray(nullIndex + 1);
        } else {
          socket.write(`UNKNOWN COMMAND\n`);
          socket.end();
          return;
        }
      }

      if (this.options.behavior.type === "disconnect") {
        socket.destroy();
        return;
      }

      // Parse length-prefixed chunks
      while (buffer.length >= 4 && !terminated) {
        const chunkLen = buffer.readUInt32BE(0);

        if (chunkLen === 0) {
          terminated = true;
          buffer = buffer.subarray(4);
          this.sendResponse(socket);
          return;
        }

        if (buffer.length < 4 + chunkLen) {
          // Wait for more data
          return;
        }

        const chunkData = buffer.subarray(4, 4 + chunkLen);
        this.receivedChunks.push({
          length: chunkLen,
          data: Buffer.from(chunkData),
        });
        buffer = buffer.subarray(4 + chunkLen);
      }
    });

    socket.on("error", () => {
      // Ignore socket errors in mock server
    });
  }

  private sendResponse(socket: Socket): void {
    const { behavior, responseDelay = 0 } = this.options;

    const doSend = () => {
      let response: string;
      switch (behavior.type) {
        case "ok":
          response = "stream: OK\n";
          break;
        case "found":
          response = `stream: ${behavior.virus} FOUND\n`;
          break;
        case "error":
          response = `stream: ${behavior.message} ERROR\n`;
          break;
        case "timeout":
          // Never respond
          return;
        case "custom":
          response = behavior.response;
          break;
        default:
          response = "stream: OK\n";
      }
      socket.write(response, () => socket.end());
    };

    if (responseDelay > 0) {
      setTimeout(doSend, responseDelay);
    } else {
      doSend();
    }
  }
}
