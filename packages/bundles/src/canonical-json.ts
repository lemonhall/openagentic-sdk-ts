function canonicalStringify(value: unknown): string {
  if (value === null) return "null";

  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical JSON does not support non-finite numbers");
    return JSON.stringify(value);
  }
  if (t === "boolean") return value ? "true" : "false";

  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalStringify(v)).join(",")}]`;
  }

  if (t === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const v = record[key];
      if (v === undefined) throw new Error("canonical JSON does not support undefined");
      parts.push(`${JSON.stringify(key)}:${canonicalStringify(v)}`);
    }
    return `{${parts.join(",")}}`;
  }

  throw new Error(`canonical JSON does not support type: ${t}`);
}

export function canonicalJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalStringify(value));
}
