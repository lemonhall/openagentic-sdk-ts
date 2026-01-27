function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value) && typeof (value as any)[Symbol.asyncIterator] === "function";
}

export async function* iterUtf8Lines(body: unknown): AsyncGenerator<string> {
  if (!body) return;

  const decoder = new TextDecoder();
  let buf = "";

  if (typeof (body as any).getReader === "function") {
    const reader = (body as any).getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        buf += decoder.decode(value, { stream: true });
        while (true) {
          const idx = buf.indexOf("\n");
          if (idx < 0) break;
          const line = buf.slice(0, idx + 1);
          buf = buf.slice(idx + 1);
          yield line.replace(/\r?\n$/, "");
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  } else if (isAsyncIterable(body)) {
    for await (const chunk of body) {
      if (!chunk) continue;
      if (typeof chunk === "string") buf += chunk;
      else buf += decoder.decode(chunk as Uint8Array, { stream: true });
      while (true) {
        const idx = buf.indexOf("\n");
        if (idx < 0) break;
        const line = buf.slice(0, idx + 1);
        buf = buf.slice(idx + 1);
        yield line.replace(/\r?\n$/, "");
      }
    }
  }

  buf += decoder.decode();
  if (buf) {
    for (const line of buf.split(/\r?\n/)) yield line;
  }
}

export async function* parseSseData(body: unknown): AsyncGenerator<string> {
  let eventData: string[] = [];
  for await (const line of iterUtf8Lines(body)) {
    if (!line.trim()) {
      if (eventData.length) {
        yield eventData.join("\n");
        eventData = [];
      }
      continue;
    }
    if (line.startsWith("data:")) {
      eventData.push(line.slice(5).trimStart());
    }
  }
  if (eventData.length) yield eventData.join("\n");
}

