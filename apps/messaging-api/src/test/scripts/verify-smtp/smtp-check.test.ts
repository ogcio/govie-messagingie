import { beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.fn();
const close = vi.fn();
const createTransport = vi.fn(() => ({ verify, close }));

vi.mock("nodemailer", () => ({
  createTransport: (...args: unknown[]) => createTransport(...args),
}));

const { checkSmtp } = await import(
  "../../../scripts/verify-smtp/smtp-check.js"
);

const config = {
  host: "smtp.example.com",
  port: 587,
  username: "user",
  password: "pass",
  secure: false,
  fromAddress: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkSmtp", () => {
  it("returns ok and closes the transport when verify succeeds", async () => {
    verify.mockResolvedValueOnce(true);

    const result = await checkSmtp(config);

    expect(result).toEqual({ ok: true });
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "user", pass: "pass" },
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("maps SMTP error fields onto the failure result", async () => {
    const smtpError = Object.assign(new Error("auth failed"), {
      code: "EAUTH",
      command: "AUTH LOGIN",
      response: "535 Authentication failed",
      responseCode: 535,
    });
    verify.mockRejectedValueOnce(smtpError);

    const result = await checkSmtp(config);

    expect(result).toEqual({
      ok: false,
      name: "Error",
      message: "auth failed",
      code: "EAUTH",
      command: "AUTH LOGIN",
      response: "535 Authentication failed",
      responseCode: 535,
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("wraps non-Error rejections in an UnknownError failure", async () => {
    verify.mockRejectedValueOnce("weird string failure");

    const result = await checkSmtp(config);

    expect(result).toEqual({
      ok: false,
      name: "UnknownError",
      message: "weird string failure",
      code: undefined,
      command: undefined,
      response: undefined,
      responseCode: undefined,
    });
  });
});
