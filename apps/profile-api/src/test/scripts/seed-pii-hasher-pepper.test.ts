import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
const clientConfigs: unknown[] = [];
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = send;
    constructor(config: unknown) {
      clientConfigs.push(config);
    }
  },
  GetSecretValueCommand: class {
    kind = "get";
    constructor(readonly input: unknown) {}
  },
  CreateSecretCommand: class {
    kind = "create";
    constructor(readonly input: unknown) {}
  },
}));

class ExitSentinel extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

// The script runs at import; a successful run just finishes the module,
// error paths call process.exit(1).
const runScript = async (): Promise<number> => {
  vi.resetModules();
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
    code: number,
  ) => {
    throw new ExitSentinel(code);
  }) as never);
  try {
    await import("~/scripts/seed-pii-hasher-pepper.js");
    return 0;
  } catch (error) {
    if (error instanceof ExitSentinel) {
      return error.code;
    }
    throw error;
  } finally {
    exitSpy.mockRestore();
  }
};

describe("seed-pii-hasher-pepper", () => {
  const savedEnv = { ...process.env };
  const savedArgv = [...process.argv];

  beforeEach(() => {
    vi.clearAllMocks();
    clientConfigs.length = 0;
    process.env.AWS_SECRETS_MANAGER_ENDPOINT = "http://localhost:4566";
    process.env.AWS_SECRETS_MANAGER_REGION = "eu-west-1";
    process.env.PII_HASHER_SECRET_NAME = "pii-secret";
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    process.argv = [
      "node",
      "seed-pii-hasher-pepper.js",
      "--secret-value",
      "a-secret-value-long-enough",
    ];
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    process.argv = [...savedArgv];
  });

  it("does nothing when the secret already exists", async () => {
    send.mockResolvedValue({ SecretString: "existing" });

    await expect(runScript()).resolves.toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].kind).toBe("get");
  });

  it("creates the secret when it does not exist", async () => {
    const notFound = new Error("not found");
    notFound.name = "ResourceNotFoundException";
    send.mockRejectedValueOnce(notFound).mockResolvedValueOnce({});

    await expect(runScript()).resolves.toBe(0);
    expect(send).toHaveBeenCalledTimes(2);
    const createInput = send.mock.calls[1][0].input;
    expect(createInput.Name).toBe("pii-secret");
    expect(JSON.parse(createInput.SecretString)).toEqual({
      activeVersion: "2",
      key: Buffer.from("a-secret-value-long-enough").toString("base64"),
    });
  });

  it("passes static credentials through when provided", async () => {
    process.env.AWS_ACCESS_KEY_ID = " key-id ";
    process.env.AWS_SECRET_ACCESS_KEY = "secret-key";
    send.mockResolvedValue({});

    await expect(runScript()).resolves.toBe(0);
    expect(clientConfigs[0]).toEqual(
      expect.objectContaining({
        credentials: { accessKeyId: "key-id", secretAccessKey: "secret-key" },
      }),
    );
  });

  it("exits 1 on unexpected Secrets Manager errors", async () => {
    send.mockRejectedValue(new Error("access denied"));

    await expect(runScript()).resolves.toBe(1);
  });

  it("exits 1 when required env variables are missing", async () => {
    delete process.env.PII_HASHER_SECRET_NAME;

    await expect(runScript()).resolves.toBe(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("exits 1 when --secret-value is missing", async () => {
    process.argv = ["node", "seed-pii-hasher-pepper.js"];

    await expect(runScript()).resolves.toBe(1);
  });

  it("exits 1 when the secret value is too short", async () => {
    process.argv = [
      "node",
      "seed-pii-hasher-pepper.js",
      "--secret-value",
      "short",
    ];

    await expect(runScript()).resolves.toBe(1);
  });
});
