export type PermissionContext = {
  sessionId: string;
  toolUseId: string;
  [key: string]: unknown;
};

export type PermissionQuestion = {
  questionId: string;
  toolName: string;
  prompt: string;
  toolInput: Record<string, unknown>;
};

export type ApprovalResult = {
  allowed: boolean;
  question?: PermissionQuestion;
  updatedInput?: Record<string, unknown>;
  denyMessage?: string;
};

export type Approver = (q: PermissionQuestion, ctx: PermissionContext) => Promise<boolean> | boolean;

export type AskOncePolicyOptions = {
  approver?: Approver;
};

export class AskOncePermissionGate {
  #approver?: Approver;
  #approvedToolNamesBySession = new Map<string, Set<string>>();

  constructor(options: AskOncePolicyOptions = {}) {
    this.#approver = options.approver;
  }

  resetSession(sessionId: string): void {
    this.#approvedToolNamesBySession.delete(sessionId);
  }

  async approve(toolName: string, toolInput: Record<string, unknown>, ctx: PermissionContext): Promise<ApprovalResult> {
    const sessionId = String(ctx.sessionId ?? "");
    if (!sessionId) throw new Error("PermissionGate.approve: sessionId required");

    let approved = this.#approvedToolNamesBySession.get(sessionId);
    if (!approved) {
      approved = new Set();
      this.#approvedToolNamesBySession.set(sessionId, approved);
    }

    if (approved.has(toolName)) return { allowed: true };

    const question: PermissionQuestion = {
      questionId: String(ctx.toolUseId ?? ""),
      toolName,
      prompt: `Allow tool ${toolName}?`,
      toolInput,
    };

    if (!this.#approver) return { allowed: false, question, denyMessage: "no approver configured" };

    const allowed = await this.#approver(question, ctx);
    if (allowed) approved.add(toolName);
    return { allowed: Boolean(allowed), question };
  }
}
