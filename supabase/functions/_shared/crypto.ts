/**
 * AES-256-GCM encryption/decryption for tokens at rest.
 * Uses the Web Crypto API (native in Deno).
 * ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes).
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const TAG_LENGTH = 128; // bits

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get("ENCRYPTION_KEY");
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes for AES-256)");
  }
  const rawKey = hexToBytes(keyHex);
  return crypto.subtle.importKey("raw", rawKey, { name: ALGORITHM }, false, ["encrypt", "decrypt"]);
}

/**
 * Encrypts a plaintext string. Returns "enc:v1:<iv_hex>:<ciphertext_hex>".
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoded,
  );
  const cipherBytes = new Uint8Array(cipherBuffer);
  return `enc:v1:${bytesToHex(iv)}:${bytesToHex(cipherBytes)}`;
}

/**
 * Decrypts a token string. If it doesn't start with "enc:v1:", returns as-is (plaintext fallback).
 */
export async function decryptToken(stored: string): Promise<string> {
  if (!stored.startsWith("enc:v1:")) {
    // Plaintext token (not yet encrypted) — return as-is
    return stored;
  }
  const parts = stored.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted token format");
  }
  const iv = hexToBytes(parts[2]);
  const cipherBytes = hexToBytes(parts[3]);
  const key = await getKey();
  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    cipherBytes,
  );
  return new TextDecoder().decode(plainBuffer);
}

/**
 * Checks whether a stored value is already encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith("enc:v1:");
}
