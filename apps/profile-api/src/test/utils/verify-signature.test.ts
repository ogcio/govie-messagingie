import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySignature } from "~/utils/verify-signature.js";

describe("verifySignature", () => {
  const signingKey = "test-secret-key";

  // Helper to generate test signatures
  const generateSignature = (key: string, payload: Buffer): string => {
    const hmac = createHmac("sha256", key);
    hmac.update(payload);
    return hmac.digest("hex");
  };

  it("should verify valid signature", () => {
    const payload = Buffer.from('{"test":"data"}');
    const signature = generateSignature(signingKey, payload);

    const result = verifySignature(signingKey, payload, signature);

    expect(result).toBe(true);
  });

  it("should reject invalid signature", () => {
    const payload = Buffer.from('{"test":"data"}');
    const invalidSignature = "invalid-signature";

    const result = verifySignature(signingKey, payload, invalidSignature);

    expect(result).toBe(false);
  });

  it("should be sensitive to payload changes", () => {
    const payload1 = Buffer.from('{"test":"data1"}');
    const payload2 = Buffer.from('{"test":"data2"}');
    const signature = generateSignature(
      signingKey,
      Buffer.from('{"test":"data"}'),
    );

    expect(verifySignature(signingKey, payload1, signature)).toBe(false);
    expect(verifySignature(signingKey, payload2, signature)).toBe(false);
  });

  it("should be sensitive to signing key changes", () => {
    const payload = Buffer.from('{"test":"data"}');
    const signature = generateSignature(signingKey, payload);

    const result = verifySignature("different-key", payload, signature);

    expect(result).toBe(false);
  });

  it("should handle empty payload", () => {
    const payload = Buffer.from("");
    const signature = generateSignature(signingKey, payload);

    const result = verifySignature(signingKey, payload, signature);

    expect(result).toBe(true);
  });
});
