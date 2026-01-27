import type { Tool, ToolContext } from "@openagentic/sdk-core";

const STATUSES = new Set(["pending", "in_progress", "completed", "cancelled"]);
const PRIORITIES = new Set(["low", "medium", "high"]);

export class TodoWriteTool implements Tool {
  readonly name = "TodoWrite";
  readonly description = "Write or update a TODO list for the current session.";
  readonly inputSchema = {
    type: "object",
    properties: {
      todos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            content: { type: "string" },
            activeForm: { type: "string" },
            status: { type: "string" },
            priority: { type: "string" },
            id: { type: "string" },
          },
          required: ["content", "status"],
        },
      },
    },
    required: ["todos"],
  };

  async run(toolInput: Record<string, unknown>, _ctx: ToolContext): Promise<unknown> {
    const todos = toolInput.todos;
    if (!Array.isArray(todos) || todos.length === 0) throw new Error("TodoWrite: 'todos' must be a non-empty list");

    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;

    for (const t of todos) {
      if (!t || typeof t !== "object" || Array.isArray(t)) throw new Error("TodoWrite: each todo must be an object");
      const obj = t as any;
      const content = obj.content;
      const activeForm = obj.activeForm;
      const status = obj.status;
      const priority = obj.priority;
      const id = obj.id;

      if (typeof content !== "string" || !content) throw new Error("TodoWrite: todo 'content' must be a non-empty string");
      if (typeof status !== "string" || !STATUSES.has(status)) {
        throw new Error("TodoWrite: todo 'status' must be 'pending', 'in_progress', 'completed', or 'cancelled'");
      }
      if (activeForm != null && (typeof activeForm !== "string" || !activeForm)) {
        throw new Error("TodoWrite: todo 'activeForm' must be a non-empty string when provided");
      }
      if (priority != null && (typeof priority !== "string" || !PRIORITIES.has(priority))) {
        throw new Error("TodoWrite: todo 'priority' must be 'low', 'medium', or 'high' when provided");
      }
      if (id != null && (typeof id !== "string" || !id)) {
        throw new Error("TodoWrite: todo 'id' must be a non-empty string when provided");
      }

      if (status === "pending") pending += 1;
      else if (status === "in_progress") inProgress += 1;
      else if (status === "completed") completed += 1;
      else cancelled += 1;
    }

    return {
      message: "Updated todos",
      stats: { total: todos.length, pending, in_progress: inProgress, completed, cancelled },
    };
  }
}

