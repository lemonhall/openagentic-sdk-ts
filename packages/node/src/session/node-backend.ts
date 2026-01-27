import type { JsonlBackend } from "@openagentic/sdk-core";

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function createNodeJsonlBackend(rootDir: string): JsonlBackend {
  const resolve = (p: string) => join(rootDir, p);
  return {
    async mkdirp(dir: string) {
      await mkdir(resolve(dir), { recursive: true });
    },
    async readText(path: string) {
      return readFile(resolve(path), "utf8");
    },
    async writeText(path: string, text: string) {
      await mkdir(dirname(resolve(path)), { recursive: true });
      await writeFile(resolve(path), text, "utf8");
    },
    async appendText(path: string, text: string) {
      await mkdir(dirname(resolve(path)), { recursive: true });
      await appendFile(resolve(path), text, "utf8");
    },
  };
}
