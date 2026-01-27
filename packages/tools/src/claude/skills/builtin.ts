export type BuiltinSkill = {
  name: string;
  description: string;
  summary?: string;
  checklist?: string[];
  body: string;
};

export const BUILTIN_SKILLS: BuiltinSkill[] = [
  {
    name: "tashan-development-loop",
    description: "Analysis → Design → Plan → TDD → Red/Green → Review → Next",
    summary: "A strict, test-driven development discipline for agentic coding.",
    checklist: [
      "Analysis: facts/constraints/success",
      "Design: options/tradeoffs",
      "Plan: executable tasks",
      "TDD Red: failing test",
      "TDD Green: minimal pass",
      "Refactor: keep green",
      "Review: verify + next task",
    ],
    body: [
      "# 塔山开发循环（Tashan Development Loop）",
      "",
      "目标：把纪律固化成默认行为。只认：可复现的分析、可执行的计划、可跑的测试、可验证的输出。",
      "",
      "## Checklist",
      "1) Analysis: 收集事实 + 约束 + 成功标准",
      "2) Design: 2–3 方案 + 推荐 + 取舍",
      "3) Plan: 拆任务 + 明确文件/命令/预期",
      "4) TDD Red: 写失败测试 + 跑到红",
      "5) TDD Green: 最小实现 + 跑到绿",
      "6) Refactor: 必要重构（仍绿）",
      "7) Review: 复盘 + 风险 + 下一个最小任务",
      "",
      "原则：NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST。",
    ].join("\n"),
  },
];

