export function defaultBundleBaseUrlFromProxy(proxyBaseUrl: string): string {
  const trimmed = String(proxyBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("/v1")) return trimmed.slice(0, -3);
  return trimmed;
}

