import { createHmac } from "node:crypto";

// https://docs.logto.io/docs/recipes/webhooks/securing-your-webhooks/
const verifySignature = (
  signingKey: string,
  rawBody: Buffer,
  expectedSignature: string,
) => {
  const hmac = createHmac("sha256", signingKey);
  hmac.update(rawBody);
  const signature = hmac.digest("hex");
  return signature === expectedSignature;
};

export { verifySignature };
