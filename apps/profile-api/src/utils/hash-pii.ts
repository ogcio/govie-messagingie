import { createHmac, randomBytes } from "node:crypto";

/**
 * Hash PII (Personally Identifiable Information) using SHA256 with random pepper.
 * Each call uses a different random pepper to prevent reverse lookups.
 * @param value The PII value to hash
 * @returns The hashed value as a hex string
 */
export function hashPII(value: string): string {
  // Use a random pepper every time to prevent the possibility
  // to get back the original value from the hash
  const randomPepper = randomBytes(32).toString("base64");

  return createHmac("sha256", randomPepper)
    .update(value.toLowerCase().trim())
    .digest("hex");
}
