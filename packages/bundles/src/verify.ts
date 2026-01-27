function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function toArrayBufferBytes(data: Uint8Array): Uint8Array<ArrayBuffer> {
  if (data.buffer instanceof ArrayBuffer) return data as unknown as Uint8Array<ArrayBuffer>;
  return new Uint8Array(data) as unknown as Uint8Array<ArrayBuffer>;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle?.digest) throw new Error("sha256Hex requires crypto.subtle");
  const buf = await globalThis.crypto.subtle.digest("SHA-256", toArrayBufferBytes(data));
  return toHex(buf);
}

export async function verifySha256(data: Uint8Array, expectedHex: string): Promise<void> {
  const got = await sha256Hex(data);
  if (got.toLowerCase() !== expectedHex.toLowerCase()) throw new Error("sha256 mismatch");
}
