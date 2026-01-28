# 沙箱（Sandboxing）

从 **v13（2026-01-28）** 开始，本仓库 **放弃 WASI 工具链 / bundles / registry**。可行的沙箱方案变为：

- **浏览器：** 运行在浏览器沙箱内，工具只操作 OPFS **shadow workspace**（不再执行 WASI）。
- **Node/服务器：** 以 **宿主机原生进程** 执行工具，并在可用时用 OS 沙箱加固，同时把文件系统视图限制在 **shadow workspace 目录**。

## 分层模型

### 浏览器侧

- **浏览器沙箱：** 平台本身限制进程/系统调用能力。
- **OPFS 影子工作区：** 工具只在 OPFS 的影子工作区上读写。
- **导入/提交边界：** 真实文件系统（File System Access API）只在明确的用户动作下访问（Import/Commit）。

### 服务器侧（默认）

- **Shadow workspace 目录：** 工具只能看到影子目录（不是用户真实仓库）。
- **OS 沙箱（可选但建议）：** 用 Bubblewrap/nsjail/sandbox-exec/jobobject 等后端包裹执行。

## 后端矩阵（服务器侧）

| 平台 | 后端 | FS 隔离 | 网络隔离 | 资源限制 | 安装复杂度 | 推荐场景 |
|---|---|---|---|---|---|---|
| Linux | `bwrap` | yes | 可选 | 部分 | 中 | 生产级加固 |
| Linux | `nsjail` | 部分 | 可选 | 部分 | 高 | Bubblewrap 不可用时的 best-effort 加固 |
| macOS | `sandbox-exec` | 部分 | 可选 | no | 低 | best-effort 加固 |
| Windows | `jobobject` | no | no | 部分 | 低 | 超时/进程树收敛 |
| 任意 | `none` | no | no | 部分 | 低 | 仅用于调试（不建议对不可信 prompt 使用） |

## 后端选择方式（Node/服务器）

通过 `@openagentic/sdk-node` 选择后端并构造 `NativeRunner`：

```ts
import { parseSandboxConfig, getSandboxBackend } from "@openagentic/sdk-node";

const shadowDir = "/path/to/shadow";
const cfg = parseSandboxConfig({ backend: "bwrap", options: { network: "deny" } });
const backend = getSandboxBackend(cfg.backend);
const nativeRunner = backend.createNativeRunner({ config: cfg, shadowDir });
```

## Native 引擎示意图（v6）

服务器侧 **native 引擎 + Bubblewrap** 的时序图：

![Native engine (Bubblewrap) sequence diagram](native_sandbox_sequenceDiagram_v6.png)

