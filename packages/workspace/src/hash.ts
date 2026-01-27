function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function toArrayBufferBytes(data: Uint8Array): Uint8Array<ArrayBuffer> {
  // TS lib types model Uint8Array as potentially backed by SharedArrayBuffer.
  // WebCrypto and some writable sinks are typed as ArrayBuffer-only.
  if (data.buffer instanceof ArrayBuffer) return data as unknown as Uint8Array<ArrayBuffer>;
  return new Uint8Array(data) as unknown as Uint8Array<ArrayBuffer>;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle?.digest) {
    throw new Error("sha256 requires WebCrypto (crypto.subtle)");
  }
  const buf = await globalThis.crypto.subtle.digest("SHA-256", toArrayBufferBytes(data));
  return toHex(buf);
}
