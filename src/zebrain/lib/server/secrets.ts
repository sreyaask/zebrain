import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Users' Kaggle and Hugging Face tokens are stored encrypted (AES-256-GCM) with TOKEN_ENCRYPTION_KEY, a 32-byte key
// in base64 or hex that only the server has. Values saved before encryption are read as they are and encrypted the
// next time the user saves. Make a key with: openssl rand -base64 32
const PREFIX = "enc:v1:";

function key() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || "";
  const k = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return k.length === 32 ? k : null;
}

export class NoEncryptionKey extends Error {
  constructor() {
    super("The server can't store tokens safely: TOKEN_ENCRYPTION_KEY isn't set.");
  }
}

export function seal(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const k = key();
  if (!k) {
    if (process.env.NODE_ENV === "production") throw new NoEncryptionKey();
    return plain; // local development without a key: stored as-is
  }
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(":");
}

export function unseal(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored; // saved before encryption was switched on
  const k = key();
  if (!k) throw new NoEncryptionKey();
  const [iv, tag, data] = stored.slice(PREFIX.length).split(":").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
