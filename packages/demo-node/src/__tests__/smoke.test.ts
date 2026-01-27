import { describe, expect, it } from "vitest";

import * as demo from "../index.js";

describe("@openagentic/demo-node", () => {
  it("exports runCli()", () => {
    expect(demo).toHaveProperty("runCli");
  });
});

