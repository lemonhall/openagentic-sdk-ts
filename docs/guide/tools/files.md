# File + Workspace Tools

All file tools operate on the **shadow workspace** provided by the host in `ToolContext.workspace`.

## `Read`

Reads a file from the shadow workspace.

**Input**
- `file_path` (string, required): workspace-relative path
- `filePath` (string, optional): alias of `file_path`
- `offset` (int|string, optional): 1-based line offset (for line-numbered output)
- `limit` (int|string, optional): number of lines to return

**Output**
- `file_path` (string)
- `content` (string) for text files
- For common image extensions (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`): `image` (base64), `mime_type`, `file_size`

**Example prompts**
- “Read `src/index.ts`.”
- “Read `README.md` from line 120 for 40 lines.”

## `Write`

Creates or overwrites a file in the shadow workspace.

**Input**
- `file_path` (string, required)
- `filePath` (string, optional): alias of `file_path`
- `content` (string, required)
- `overwrite` (boolean, default `false`): prevent accidental clobbering

**Output**
- `file_path`, `bytes_written`, `message`

**Example prompts**
- “Create `notes.txt` with a short summary.”
- “Overwrite `TODO.md` with today’s plan (overwrite=true).”

## `Edit`

Applies a precise string replacement in a file (good for deterministic edits).

**Input**
- `file_path` (string, required)
- `filePath` (string, optional): alias of `file_path`
- `old` (string, required): exact text to replace
- `old_string` / `oldString` (string, optional): alias of `old`
- `new` (string, required): replacement
- `new_string` / `newString` (string, optional): alias of `new`
- `count` (int, default `1`): number of replacements (`0` means replace all)
- `replace_all` (boolean, default `false`): sets `count=0`
- `replaceAll` (boolean, optional): alias of `replace_all`
- `before` / `after` (string, optional): anchors to reduce accidental mismatches

**Output**
- `file_path`, `replacements`, `message`

**Example prompts**
- “In `src/app.ts`, replace `foo()` with `bar()` exactly once.”
- “Replace all occurrences of `http://` with `https://` in `README.md`.”

## `ListDir`

Lists a directory in the shadow workspace.

**Input**
- `path` (string, optional): directory path (default: workspace root)

**Output**
- `{ path, entries: [{ name, type: "file" | "dir" }] }`

## `Glob`

Finds files by glob pattern. Supported subset: `*`, `?`, and `**` (recursive).

**Input**
- `pattern` (string, required)
- `root` (string, optional): base dir
- `path` (string, optional): alias of `root`
- `max_files` (int, optional): hard cap on scanned files

**Output**
- `matches` (string[])
- `count`

**Example prompts**
- “Find all `**/*.ts` files under `src`.”

## `Grep`

Searches file contents using a regex (JavaScript `RegExp`) across workspace files.

**Input**
- `query` (string, required): regex pattern
- `file_glob` (string, default `**/*`)
- `root` (string, optional)
- `path` (string, optional): alias of `root`
- `case_sensitive` (boolean, default `true`)
- `mode` (`content` | `files_with_matches`)
- `before_context` / `after_context` (int, default `0`)

**Output**
- `matches[]` with `{ file_path, line, text, before_context, after_context }`
- or `files[]` in `files_with_matches` mode

**Example prompts**
- “Search for `TODO` across the workspace.”
- “Find all files mentioning `OpenAI_BASE_URL`.”
