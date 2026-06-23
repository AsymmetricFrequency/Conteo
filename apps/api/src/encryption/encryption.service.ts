import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.ENCRYPTION_KEY ?? "conteo-dev-key-change-in-production-32b";
    this.key = createHash("sha256").update(raw).digest();
  }

  encrypt(text: string): { encrypted: string; iv: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      encrypted: Buffer.concat([encrypted, authTag]).toString("base64"),
      iv: iv.toString("base64"),
    };
  }

  decrypt(encrypted: string, iv: string): string {
    const ivBuf = Buffer.from(iv, "base64");
    const data = Buffer.from(encrypted, "base64");
    const authTag = data.subarray(data.length - 16);
    const ciphertext = data.subarray(0, data.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", this.key, ivBuf);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }
}
