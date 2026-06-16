import { createTransport } from "nodemailer";
import type { SmtpConfig } from "./config/load-config.js";

export type SmtpCheckSuccess = {
  readonly ok: true;
};

export type SmtpCheckFailure = {
  readonly ok: false;
  readonly name: string;
  readonly message: string;
  readonly code: string | undefined;
  readonly command: string | undefined;
  readonly response: string | undefined;
  readonly responseCode: number | undefined;
};

export type SmtpCheckResult = SmtpCheckSuccess | SmtpCheckFailure;

export async function checkSmtp(config: SmtpConfig): Promise<SmtpCheckResult> {
  const transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  try {
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    return buildFailure(error);
  } finally {
    transporter.close();
  }
}

function buildFailure(error: unknown): SmtpCheckFailure {
  if (error instanceof Error) {
    const smtpError = error as Error & {
      code?: string;
      command?: string;
      response?: string;
      responseCode?: number;
    };

    return {
      ok: false,
      name: smtpError.name,
      message: smtpError.message,
      code: smtpError.code,
      command: smtpError.command,
      response: smtpError.response,
      responseCode: smtpError.responseCode,
    };
  }

  return {
    ok: false,
    name: "UnknownError",
    message: String(error),
    code: undefined,
    command: undefined,
    response: undefined,
    responseCode: undefined,
  };
}
