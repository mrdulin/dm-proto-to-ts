# proto-to-ts CLI 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `@d-matrix/proto-to-ts` 从 MCP Server 改造成仅支持 Windows 的 Node CLI，并移除 MCP 相关代码与依赖。

**架构：** 保留 `ProtoGeneratorService` 作为核心生成服务，将 CLI 参数解析放在 `src/index.ts`，把原 `scripts/gen-proto.mjs` 平移到 `src/` 下的单个内部脚本文件中，并由服务层直接调用编译后的 `dist` 脚本。README 和包元数据同步切换到 CLI 场景。

**技术栈：** TypeScript、Node.js ESM、npm、`protoc.exe`、`ts-proto`

---

### 任务 1：改造 CLI 入口

**文件：**
- 修改：`src/index.ts`
- 参考：`src/constants.ts`
- 测试：`node dist/index.js --help`

- [ ] **步骤 1：梳理 CLI 入口需要覆盖的行为**

确认 `src/index.ts` 需要处理：

- `proto-to-ts <proto-file> <output-dir>`
- `proto-to-ts --help`
- `proto-to-ts --version`
- 参数错误时输出 usage 并退出 `1`
- 非 Windows 平台直接报错并退出 `1`

- [ ] **步骤 2：实现最小 CLI 参数解析**

在 `src/index.ts` 中移除 MCP 启动逻辑，改为：

- 读取 `process.argv`
- 调用帮助输出函数
- 调用版本输出函数
- 正常路径下实例化 `ProtoGeneratorService`
- 输出生成摘要

- [ ] **步骤 3：统一 CLI 错误输出**

确保错误输出满足：

- 原因明确
- 与命令用法相关时带 usage
- 退出码正确

- [ ] **步骤 4：构建后手动验证帮助与版本输出**

运行：

`node dist/index.js --help`

`node dist/index.js --version`

预期：

- 两条命令均正常输出并返回退出码 `0`

### 任务 2：迁移内部生成脚本到 `src/`

**文件：**
- 删除：`scripts/gen-proto.mjs`
- 创建：`src/gen-proto.ts`
- 修改：`src/services/proto-generator.ts`
- 测试：`node dist/index.js <sample.proto> <temp-dir>`

- [ ] **步骤 1：平移内部脚本逻辑**

将 `scripts/gen-proto.mjs` 迁移到 `src/gen-proto.ts`，保持单文件、职责单一，不额外拆模块。

- [ ] **步骤 2：调整脚本内路径解析**

确保迁移后的脚本在 `dist` 中运行时仍能正确定位：

- 包根目录
- `protoc.exe`
- `node_modules/.bin/protoc-gen-ts_proto.cmd`
- 环境变量 `PROTO_TS_INPUT_DIR`、`PROTO_TS_OUTPUT_DIR`

- [ ] **步骤 3：调整服务层对子脚本的调用方式**

在 `src/services/proto-generator.ts` 中：

- 移除 `npm run _gen_proto` 相关命令解析
- 直接调用编译后的内部脚本
- 去掉 MCP 残留命名和文案

- [ ] **步骤 4：验证真实生成链路**

构建后运行：

`node dist/index.js <sample.proto> <temp-dir>`

预期：

- 生成同名 `.ts` 文件
- 输出包含目标文件路径

### 任务 3：移除 MCP 相关代码和依赖

**文件：**
- 删除：`src/tools/register-proto-tools.ts`
- 修改：`src/constants.ts`
- 修改：`src/types.ts`
- 修改：`package.json`
- 修改：`package-lock.json`
- 测试：`npm run typecheck`

- [ ] **步骤 1：删除 MCP 工具注册代码**

移除 `src/tools/register-proto-tools.ts`，并清理入口处对该文件的引用。

- [ ] **步骤 2：清理常量与类型中的 MCP 残留**

检查 `src/constants.ts`、`src/types.ts`，删除或重命名仅服务于 MCP 的内容。

- [ ] **步骤 3：更新包配置**

在 `package.json` 中：

- 删除 `@modelcontextprotocol/sdk`
- 删除 `zod`
- 删除 `_gen_proto`
- 更新 `description`
- 更新 `keywords`
- 从 `files` 中移除 `scripts`

同步更新 `package-lock.json`。

- [ ] **步骤 4：运行类型检查**

运行：

`npm run typecheck`

预期：

- 退出码为 `0`

### 任务 4：更新 README 并完成验证

**文件：**
- 修改：`README.md`
- 测试：`npm run build`
- 测试：`npm run typecheck`
- 测试：`node dist/index.js --help`
- 测试：`node dist/index.js --version`
- 测试：`node dist/index.js <sample.proto> <temp-dir>`

- [ ] **步骤 1：将 README 改写为 CLI 文档**

README 至少要包含：

- 工具简介
- Windows 平台限制
- `npx` 用法
- `--help`、`--version` 示例
- 输入输出说明
- 常见错误说明

- [ ] **步骤 2：准备最小验证输入**

如果仓库内没有合适的示例 `.proto`，创建一个最小示例文件用于本地验证。

- [ ] **步骤 3：运行完整验证**

运行：

`npm run build`

`npm run typecheck`

`node dist/index.js --help`

`node dist/index.js --version`

`node dist/index.js <sample.proto> <temp-dir>`

预期：

- 构建成功
- 类型检查通过
- CLI 帮助和版本输出正确
- 真实生成链路可用

- [ ] **步骤 4：复查产物与差异**

检查最终差异，确认：

- 未改动无关文件
- `scripts/gen-proto.mjs` 已删除
- MCP 相关代码和依赖已清理
