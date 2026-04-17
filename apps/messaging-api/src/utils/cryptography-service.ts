import crypto from "node:crypto";

class CryptographyService {
  private encryptionAlgorithm: string;
  private encryptionKey: Buffer;

  constructor(config: { EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: string }) {
    const encryptionKeyBase64 = config.EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY;
    if (!encryptionKeyBase64 || encryptionKeyBase64.length === 0) {
      throw Error("Missing env var EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY");
    }

    this.encryptionKey = Buffer.from(encryptionKeyBase64, "base64");

    if (this.encryptionKey.length !== 32) {
      throw Error(
        "EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY must be 32 bytes when decoded from base64",
      );
    }

    this.encryptionAlgorithm = "aes-256-cbc";
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.encryptionAlgorithm,
      this.encryptionKey,
      iv,
    );
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    return iv.toString("hex") + encrypted;
  }

  decrypt(encryptedText: string): string {
    const iv = Buffer.from(encryptedText.slice(0, 32), "hex");
    const encrypted = encryptedText.slice(32);
    const decipher = crypto.createDecipheriv(
      this.encryptionAlgorithm,
      this.encryptionKey,
      iv,
    );
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

export default CryptographyService;
