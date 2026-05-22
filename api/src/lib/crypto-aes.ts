/**
 * AES-256-GCM での at-rest 暗号化（取引所 API key 等）
 *
 * env `OFFRAMP_ENCRYPTION_KEY` は base64 エンコードされた 32 バイト鍵。
 * 生成: `openssl rand -base64 32`
 *
 * 暗号文形式: base64( iv (12B) || ciphertext || tag (16B) )
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.OFFRAMP_ENCRYPTION_KEY;
  if (!raw) throw new Error("OFFRAMP_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`OFFRAMP_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`);
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, "base64");
  if (data.length < IV_LEN + TAG_LEN) {
    throw new Error("Invalid ciphertext (too short)");
  }
  const iv  = data.subarray(0, IV_LEN);
  const tag = data.subarray(data.length - TAG_LEN);
  const ct  = data.subarray(IV_LEN, data.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
