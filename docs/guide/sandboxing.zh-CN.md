# 沙箱（Sandboxing）

OpenAgentic SDK TS 的目标是同时做到两件事：

- **工具语义可移植**（同一套 tool bundle 在浏览器/服务器上尽量一致）
- **纵深防御**（Defense in depth，在关键边界叠加多层隔离）

## 分层模型

### 浏览器侧

- **浏览器沙箱**：平台本身已经限制了进程/系统调用等能力。
- **OPFS 影子工作区**：工具只在 OPFS（Origin Private File System）里的影子工作区上读写。
- **导入/提交边界**：真实文件系统（File System Access API）只在明确的用户动作下访问（Import/Commit）。

### 服务器侧（默认）

- **WASI 沙箱**：工具以 WASI 模块执行，只能看到预先打开（preopen）的影子工作区目录。
- **不需要 Docker**：默认路径是“同语义 WASI runner”（例如 `wasmtime`）。

## 执行引擎（服务器侧）

本仓库支持（或计划支持）两类服务器侧 **执行引擎**：

1) **WASI 引擎（可移植、与浏览器对齐）**  
   执行签名的 WASI tool bundles。默认选择，也是最接近“浏览器/服务器同语义”的路径。

2) **Native 引擎（仅 Linux、使用宿主机工具）**  
   在 Bubblewrap 沙箱中直接运行宿主机原生命令（例如 `bash` / `grep` / `git`）。它牺牲可移植性与浏览器对齐，换取部署便利（不用分发 bundles）。

### 服务器侧（可选加固）

在服务器上可以再加一层 **外层沙箱**，把 WASI runner 进程包一层（“沙箱叠加 / sandbox stacking”）：

- 内层：WASI（工具语义、跨平台一致性）
- 外层：OS/VM 沙箱（部署级加固）

这样做的价值是：在不引入“第二套工具链”的前提下，获得更强的进程级隔离能力（文件系统视图、网络命名空间等）。

## 术语澄清（避免误会）

本项目把两个概念分开：

- **执行引擎（execution engine）**：真正“跑工具”的东西（当前是 WASI，通过 `wasmtime` 执行 WASI tool bundles）。
- **沙箱技术（sandbox technology）**：用什么手段去约束/隔离 runner 进程（当前是可选 Bubblewrap）。

Bubblewrap（`bwrap`）本质是一个 **进程沙箱**：它自己并不会“运行工具”，而是把某个程序（例如 `wasmtime`，或未来的 native runner）包起来，并限制它能看到的文件系统/网络等。

因此：在当前实现里开启 Bubblewrap 时，链路里仍然会出现 `wasmtime` —— 这是刻意的设计选择，因为 WASI 仍是执行引擎，用来保证浏览器/服务器的工具语义尽量一致。

## 时序图（服务器侧：WASI 执行引擎 + Bubblewrap 外层沙箱）

```mermaid
sequenceDiagram
  autonumber
  participant U as 用户/运维
  participant A as AgentRuntime
  participant TR as ToolRunner
  participant CMD as CommandTool (WASI)
  participant WR as WasmtimeWasiRunner
  participant PS as ProcessSandbox 适配器
  participant BW as bubblewrap (bwrap)
  participant WM as wasmtime
  participant M as WASI 模块（工具）

  U->>A: 用户消息
  A->>TR: 触发工具调用（Bash/Shell → Command(argv)）
  TR->>CMD: 在影子工作区执行 argv
  CMD->>WR: execModule({ preopenDir: shadowDir, argv, env, limits })
  WR->>PS: wrap({ cmd: wasmtime, args, mounts })
  PS-->>WR: { cmd: bwrap, args: [bwrap..., wasmtime, ...rewrittenArgs] }
  WR->>BW: spawn(bwrap ... wasmtime ...)
  BW->>WM: 在受限 mount/ns 中执行
  WM->>M: 运行 WASI 模块（预打开 /workspace）
  M-->>WM: stdout/stderr/exit
  WM-->>BW: 退出码 + 输出
  BW-->>WR: 退出码 + 输出
  WR-->>CMD: WasiExecResult（包含 sandboxAudits）
  CMD-->>TR: 工具结果（可选转发审计事件）
  TR-->>A: 工具结果
  A-->>U: 助手回复
```

## Native 执行引擎（v6 已实现）

如果你希望 Bubblewrap 与 WASI 在“选择其一”意义上是平级的（即启用 Bubblewrap 就完全不依赖 WASI 技术栈），那就意味着服务器侧需要第二套执行引擎：

- `WASI 引擎`：执行签名的 WASI tool bundles（可移植；与浏览器对齐）。
- `Native 引擎`：在沙箱中执行宿主机原生命令/二进制（Linux-only；除非再引入一套 Linux userland/toolchain 分发策略，否则很难与浏览器语义对齐）。

本仓库在 v6 已实现 native 引擎（见下方示意图）。v5 的重点是“外层沙箱适配器”，用于加固 WASI 路径（沙箱叠加 / sandbox stacking）。

## Native 引擎示意图（v6）

下面这张图对应 **服务器侧 native 引擎 + Bubblewrap** 的执行链路（渲染版）：

![Native 引擎（Bubblewrap）时序图](native_sandbox_sequenceDiagram_v6.png)

## nsjail（仅 Linux，可选后端）

`nsjail` 是另一个 Linux 沙箱 runner，可在一些部署中作为替代后端使用。

重要说明：

- **仅 Linux**，并依赖内核 namespaces 配置。
- 相比 Bubblewrap，这类后端更依赖“运维侧策略/参数”才能达到预期隔离强度；默认当作 **best-effort 加固** 使用更稳妥。

### Ubuntu 24.04 安装

```bash
sudo apt update
sudo apt install -y nsjail
```

验证：

```bash
nsjail --help | head
```

### Smoke 命令

```bash
nsjail --mode o --quiet -- bash -lc "echo hello from nsjail"
```

### 集成测试（条件跳过）

```bash
OPENAGENTIC_SANDBOX_INTEGRATION=1 pnpm -C packages/node test -- --run linux-sandbox.integration
```

## macOS：sandbox-exec（best-effort 后端）

部分 macOS 版本会提供 `sandbox-exec`。当它可用时，可以作为 **服务器侧 native 执行** 的 best-effort 沙箱边界。

限制：

- 可用性随 macOS 版本变化。
- 它不是 Linux 那种 mount namespace 方案，更接近 **基于策略的访问控制**；建议默认当作加固（hardening），不要把它当作“完全等价的隔离”。

检查是否存在：

```bash
command -v sandbox-exec
```

Smoke 命令：

```bash
sandbox-exec -p "(version 1)(allow default)" -- bash -lc "echo hello from sandbox-exec"
```

集成测试（条件跳过）：

```bash
OPENAGENTIC_SANDBOX_INTEGRATION=1 pnpm -C packages/node test -- --run macos-sandbox.integration
```

## Windows：Job Objects（基线后端）

Windows 的沙箱原语与 Linux/macOS 差异很大。v7 里的 Windows “jobobject” 后端是一个 **基线方案**，主要解决：

- 超时后杀掉整个进程树（避免后台残留）
- 以“时间上限”为主的资源边界（v7 先覆盖 time-based）

限制：

- 不提供文件系统命名空间隔离（不像 Bubblewrap）。
- 当前实现是超时后用 `taskkill /T /F` 做“务实的基线”；要做到真正的 Job Object 级别分配/限制，需要更深的 Win32 集成。

集成测试（条件跳过）：

```bash
OPENAGENTIC_SANDBOX_INTEGRATION=1 pnpm -C packages/node test -- --run windows-jobobject.integration
```

## Bubblewrap（`bwrap`）外层沙箱（仅 Linux）

Bubblewrap 是基于 Linux namespaces 的生产级沙箱工具（Flatpak 的核心原语之一）。在本项目里，它被当作 **可选的“外层包装器”**：用于包住 `wasmtime` 这个 runner 进程，而不是替代 WASI。

## 本项目里它是怎么工作的

在服务器上，WASI runner 本质上就是一次进程 spawn（`wasmtime ...`）。v5 增加了一个可插拔的 “process sandbox adapter”，它可以把这次 spawn 改写为：

- `bwrap ... wasmtime ...`（Bubblewrap 外层沙箱），或
- 未来的其它沙箱技术（同一个适配器契约）。

为了保证命令能正确执行，包装器需要做两件关键事情：

1) **把宿主机目录 bind 到稳定的“沙箱内路径”**
   - 影子工作区：宿主机的 shadow dir → 沙箱内 `/workspace`
   - runner 临时目录：宿主机 tmp → 沙箱内 `/__runner__`
2) **重写 `wasmtime` 的 argv**
   - 把 argv 里出现的宿主机路径改成对应的沙箱内路径（否则 `wasmtime` 在沙箱里找不到文件）。

审计（Auditing）：

- 当启用了外层沙箱包装器，`WasmtimeWasiRunner.execModule()` 会返回 `WasiExecResult.sandboxAudits`，描述“用了哪个包装器”以及“包装后的命令”（并对宿主机路径做脱敏/替换）。

## 它能提供什么

- 通过 bind mount 限制进程能看到的文件系统视图（只暴露指定目录）。
- 可选通过 `--unshare-net` 禁用网络（更强隔离）。
- 在 runner 被攻破时，进一步降低爆炸半径（相比只靠“preopen 影子目录”更硬）。

## 它不能提供什么

- 不可移植：仅 Linux 可用，且依赖内核/系统对 unprivileged user namespaces 的配置。
- 不是完整 VM 边界：内核漏洞仍然是风险面。
- 不会自动让“不安全工具”变安全：仍需要权限、审计、策略等配套。

## Ubuntu 24.04 前置安装

安装 Bubblewrap + Wasmtime：

```bash
sudo apt update
sudo apt install -y bubblewrap wasmtime
```

验证二进制：

```bash
bwrap --version
wasmtime --version
```

Bubblewrap 依赖 unprivileged user namespaces（普通用户可用的 userns）。一般 Ubuntu 默认开启，但你可以检查：

```bash
cat /proc/sys/kernel/unprivileged_userns_clone
```

输出 `1` 表示开启；如果是 `0`，普通用户下 Bubblewrap 可能无法工作。

## 手工验证（不需要 LLM）

最小 smoke：验证 `bwrap` 能在沙箱里运行 `wasmtime`：

```bash
bwrap --die-with-parent --new-session \
  --proc /proc --dev /dev --tmpfs /tmp \
  --ro-bind /usr /usr --ro-bind /bin /bin --ro-bind /lib /lib --ro-bind /lib64 /lib64 --ro-bind /etc /etc \
  wasmtime --version
```

然后跑集成测试（如果本机缺少 `bwrap`/`wasmtime` 会自动跳过）：

```bash
pnpm -C packages/wasi-runner-wasmtime test -- src/__tests__/bubblewrap.integration.test.ts
```

## 手工验证（demo-node）

如果你想把 agent demo 也跑在 Bubblewrap 外层沙箱里：

```bash
OPENAGENTIC_PROCESS_SANDBOX=bwrap \
OPENAI_API_KEY=... \
pnpm -C packages/demo-node start -- --project . --once "Use Bash to run: echo hi"
```

## Native 引擎（demo-node）

如果要让 `Bash` 直接使用宿主机原生工具并运行在 Bubblewrap 里（仅 Linux）：

```bash
OPENAGENTIC_TOOL_ENGINE=native \
OPENAI_API_KEY=... \
pnpm -C packages/demo-node start -- --project . --once "Use Bash to run: echo hi"
```

注意：

- Native 引擎依赖宿主机的 `bash`/`grep` 等工具，行为与可用性取决于宿主机环境。
- 更安全的默认建议是禁网：`OPENAGENTIC_BWRAP_NETWORK=deny`。

相关环境变量：

- `OPENAGENTIC_PROCESS_SANDBOX=bwrap`
- `OPENAGENTIC_PROCESS_SANDBOX_REQUIRED=1`（可选：不可用就直接失败）
- `OPENAGENTIC_BWRAP_PATH=bwrap`（可选：指定 bwrap 路径）
- `OPENAGENTIC_BWRAP_NETWORK=allow|deny`（可选：是否禁网）
- `OPENAGENTIC_BWRAP_RO_BINDS=/usr,/bin,/lib,/lib64,/etc`（可选：额外 ro-bind 列表）
