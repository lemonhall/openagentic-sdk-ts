# Meta / Coordination Tools

## `TodoWrite`

Validates and records a TODO list for the current session (hosts can render this in UI).

**Input**
- `todos` (array, required): each item has `content` + `status` (`pending` | `in_progress` | `completed` | `cancelled`)
- Optional: `priority` (`low` | `medium` | `high`), `id`, `activeForm`

**Output**
- counts by status (`stats`)

## `SlashCommand`

Loads `.claude/commands/<name>.md` from the **shadow workspace**.

**Input**
- `name` (string, required)

**Output**
- `{ name, path, content }`

## `Skill`

Loads a built-in skill by `name`. Skills are shipped with the SDK (not read from your real filesystem).

**Built-in skills (v2)**
- `tashan-development-loop`

**Input**
- `name` (string, required)

**Output**
- `{ title, output, name, description, summary, checklist, path }`
