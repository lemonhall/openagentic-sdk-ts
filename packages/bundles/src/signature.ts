export type PublicKeyLike = CryptoKey | JsonWebKey;

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(base64, "base64"));
  // eslint-disable-next-line no-restricted-globals
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toArrayBufferBytes(data: Uint8Array): Uint8Array<ArrayBuffer> {
  if (data.buffer instanceof ArrayBuffer) return data as unknown as Uint8Array<ArrayBuffer>;
  return new Uint8Array(data) as unknown as Uint8Array<ArrayBuffer>;
}

async function toCryptoKey(key: PublicKeyLike): Promise<CryptoKey> {
  const isCryptoKey = (k: PublicKeyLike): k is CryptoKey => {
    if (!k || typeof k !== "object") return false;
    const anyK = k as any;
    return typeof anyK.type === "string" && typeof anyK.extractable === "boolean";
  };

  if (isCryptoKey(key)) return key;
  const subtle = globalThis.crypto.subtle as unknown as SubtleCrypto;
  return subtle.importKey("jwk" as any, key as JsonWebKey, { name: "Ed25519" }, true, ["verify"]);
}

export async function verifyEd25519Signature(args: {
  publicKey: PublicKeyLike;
  message: Uint8Array;
  signatureBase64: string;
}): Promise<boolean> {
  const publicKey = await toCryptoKey(args.publicKey);
  const signature = base64ToBytes(args.signatureBase64);
  const subtle = globalThis.crypto.subtle as unknown as SubtleCrypto;
  return subtle.verify({ name: "Ed25519" }, publicKey, toArrayBufferBytes(signature), toArrayBufferBytes(args.message));
}
