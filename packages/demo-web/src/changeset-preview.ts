export type TextPreview = { text: string; truncated: boolean };

export function decodeTextPreview(bytes: Uint8Array, options: { maxChars?: number } = {}): TextPreview | null {
  const maxChars = options.maxChars ?? 20_000;
  if (!Number.isFinite(maxChars) || maxChars <= 0) throw new Error("decodeTextPreview: maxChars must be > 0");

  // Cheap binary heuristic: NUL almost always means "not a text file".
  for (const b of bytes) {
    if (b === 0) return null;
  }

  // Decode at most ~4 bytes per char to avoid massive previews.
  const maxBytes = Math.min(bytes.byteLength, maxChars * 4);
  const dec = new TextDecoder("utf-8", { fatal: false });
  const decoded = dec.decode(bytes.subarray(0, maxBytes));

  const truncatedByBytes = bytes.byteLength > maxBytes;
  const text = decoded.length > maxChars ? decoded.slice(0, maxChars) : decoded;
  const truncated = truncatedByBytes || decoded.length > maxChars;

  return { text, truncated };
}

