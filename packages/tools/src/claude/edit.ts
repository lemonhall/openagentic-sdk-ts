import type { Tool, ToolContext } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";

function replaceN(text: string, oldStr: string, newStr: string, count: number): { out: string; replacements: number } {
  if (count === 0) {
    const parts = text.split(oldStr);
    return { out: parts.join(newStr), replacements: parts.length - 1 };
  }
  let remaining = count;
  let replacements = 0;
  let out = "";
  let idx = 0;
  while (remaining > 0) {
    const j = text.indexOf(oldStr, idx);
    if (j < 0) break;
    out += text.slice(idx, j) + newStr;
    idx = j + oldStr.length;
    remaining -= 1;
    replacements += 1;
  }
  out += text.slice(idx);
  return { out, replacements };
}

export class EditTool implements Tool {
  readonly name = "Edit";
  readonly description = "Apply a precise edit (string replace) to a file in the shadow workspace.";
  readonly inputSchema = {
    type: "object",
    properties: {
      file_path: { type: "string", description: "Workspace-relative path." },
      filePath: { type: "string", description: "Alias of file_path." },
      old: { type: "string", description: "Exact text to replace." },
      old_string: { type: "string", description: "Alias of old." },
      oldString: { type: "string", description: "Alias of old." },
      new: { type: "string", description: "Replacement text." },
      new_string: { type: "string", description: "Alias of new." },
      newString: { type: "string", description: "Alias of new." },
      replace_all: { type: "boolean", description: "Replace all occurrences." },
      replaceAll: { type: "boolean", description: "Alias of replace_all." },
      count: { type: "integer", description: "Max replacements (0 = replace all). Default: 1." },
      before: { type: "string", description: "Optional anchor that must occur before `old`." },
      after: { type: "string", description: "Optional anchor that must occur after `old`." },
    },
    required: ["old", "new"],
  };

  async run(toolInput: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
    const workspace = (ctx as any).workspace as Workspace | undefined;
    if (!workspace) throw new Error("Edit: workspace is required in ToolContext");

    const filePathRaw = (toolInput.file_path ?? toolInput.filePath) as unknown;
    const filePath = typeof filePathRaw === "string" ? filePathRaw.trim() : "";
    if (!filePath) throw new Error("Edit: 'file_path' must be a non-empty string");

    const old =
      (toolInput.old ?? toolInput.old_string ?? toolInput.oldString) as unknown;
    const newStr =
      (toolInput.new ?? toolInput.new_string ?? toolInput.newString) as unknown;

    if (typeof old !== "string" || old === "") throw new Error("Edit: 'old' must be a non-empty string");
    if (typeof newStr !== "string") throw new Error("Edit: 'new' must be a string");

    const replaceAll = Boolean(toolInput.replace_all ?? toolInput.replaceAll ?? false);
    const countRaw = toolInput.count;
    const count = replaceAll ? 0 : typeof countRaw === "number" && Number.isFinite(countRaw) ? Math.trunc(countRaw) : 1;
    if (!Number.isInteger(count) || count < 0) throw new Error("Edit: 'count' must be a non-negative integer");

    const before = toolInput.before;
    const after = toolInput.after;
    if (before != null && typeof before !== "string") throw new Error("Edit: 'before' must be a string");
    if (after != null && typeof after !== "string") throw new Error("Edit: 'after' must be a string");

    const text = new TextDecoder().decode(await workspace.readFile(filePath));
    const idxOld = text.indexOf(old);
    if (idxOld < 0) throw new Error("Edit: 'old' text not found in file");

    if (typeof before === "string") {
      const idxBefore = text.indexOf(before);
      if (idxBefore < 0) throw new Error("Edit: 'before' anchor not found in file");
      if (idxBefore >= idxOld) throw new Error("Edit: 'before' must appear before 'old'");
    }
    if (typeof after === "string") {
      const idxAfter = text.indexOf(after);
      if (idxAfter < 0) throw new Error("Edit: 'after' anchor not found in file");
      if (idxOld >= idxAfter) throw new Error("Edit: 'after' must appear after 'old'");
    }

    const { out, replacements } = replaceN(text, old, newStr, count);
    await workspace.writeFile(filePath, new TextEncoder().encode(out));
    return { message: "Edit applied", file_path: filePath, replacements };
  }
}
