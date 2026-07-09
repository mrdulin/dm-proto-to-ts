# proto-to-ts CLI 改造设计

**目标**

将当前基于 MCP 的 `@d-matrix/proto-to-ts` 改造为一个仅支持 Windows 平台的 Node CLI 工具，使用户可以通过 `npx @d-matrix/proto-to-ts <proto-file> <output-dir>` 直接生成 TypeScript 文件。

**范围**

- 允许修改：
  - `src/`
  - `scripts/`
  - `bin/`
  - `package.json`
  - `package-lock.json`
  - `README.md`
- 允许删除 MCP 相关代码和依赖。
- 不引入新依赖，不升级现有依赖。

**非目标**

- 不支持 macOS 或 Linux。
- 不增加 `--include`、`--protoc` 等扩展参数。
- 不重构 `ts-proto` 生成策略。
- 不改变现有核心生成行为：读取 `.proto` 文件，调用内置 `protoc.exe` 和 `ts-proto` 生成同名 `.ts` 文件。

## 现状

当前项目通过 [src/index.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/index.ts) 启动 MCP Server，并在 [src/tools/register-proto-tools.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/tools/register-proto-tools.ts) 中注册 `proto_to_ts` 工具。实际生成逻辑集中在 [src/services/proto-generator.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/services/proto-generator.ts)，其内部目前通过 `npm run _gen_proto` 间接调用 [scripts/gen-proto.mjs](/D:/workspace/mrdulin/dm-proto-to-ts/scripts/gen-proto.mjs) 执行 `protoc.exe`。

这意味着改造重点不是重写生成链路，而是：

1. 将入口从 MCP Server 改为 CLI。
2. 删除 MCP 适配层和相关依赖。
3. 把文档和包元数据同步切换到 CLI 场景。

## 方案选择

### 方案 A：最小替换入口

- 只把 `src/index.ts` 改成解析命令行参数。
- 保留 `ProtoGeneratorService` 的主体逻辑。
- 删除工具注册层。

优点：

- 改动最小。
- 风险集中在入口和错误处理。

缺点：

- 服务层里会残留部分 MCP 命名和文案，需要顺手清理。
- 生成脚本仍停留在 `scripts/` 下，与编译产物分离。

### 方案 B：CLI 入口加一层独立命令适配

- 新增 CLI 命令模块。
- `src/index.ts` 只负责启动该模块。
- 服务层只保留纯生成职责。

优点：

- 结构更清晰。
- 后续如果扩展参数更容易维护。

缺点：

- 会增加一个新文件。
- 对当前项目体量来说略重。

### 方案 C：完全下沉到脚本层

- 直接把参数解析和流程控制放到 `scripts/gen-proto.mjs`。
- TypeScript 入口仅转发参数。

优点：

- 看起来路径更短。

缺点：

- 业务边界变差。
- 不利于保留现有服务层。
- 会让 `scripts/` 承担超出脚本工具的职责。

**推荐方案：方案 A。**

理由：当前生成逻辑已经集中在服务层，入口层替换为 CLI 即可满足目标；同时将内部生成脚本迁移到 `src/` 并纳入编译产物，可以在不引入额外抽象的前提下让发布结构更一致。

## 目标设计

### 1. CLI 入口

[bin/proto-to-ts.js](/D:/workspace/mrdulin/dm-proto-to-ts/bin/proto-to-ts.js) 保持为可执行入口，继续加载编译后的 `dist/index.js`。

[src/index.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/index.ts) 改为 CLI 主入口，支持以下命令形式：

- `proto-to-ts <proto-file> <output-dir>`
- `proto-to-ts --help`
- `proto-to-ts --version`

行为约束：

- 参数不足或过多时，输出使用说明，退出码为 `1`。
- `--help` 输出简洁用法说明，退出码为 `0`。
- `--version` 输出当前包版本，退出码为 `0`。
- 生成成功时输出结果摘要，至少包括输入文件、输出目录和生成文件路径。

### 2. 平台限制

本次版本只支持 Windows。

CLI 启动时先检查 `process.platform`：

- 如果不是 `win32`，直接报错并退出。
- 错误文案必须明确说明“当前版本仅支持 Windows 平台”。

### 3. 生成服务

[src/services/proto-generator.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/services/proto-generator.ts) 继续作为核心生成逻辑，保留以下职责：

- 校验 `.proto` 输入文件。
- 校验输出目录参数。
- 创建临时输入、输出目录。
- 调用内部生成命令。
- 将生成结果复制到目标输出目录。
- 汇总执行结果并返回。

需要调整的点：

- 去掉与 MCP 强绑定的命名和文案，例如临时目录前缀中的 `mcp`。
- 移除 `_gen_proto` npm script。
- 将 [scripts/gen-proto.mjs](/D:/workspace/mrdulin/dm-proto-to-ts/scripts/gen-proto.mjs) 迁移到 `src/`，并改造成 TypeScript 内部脚本。
- 由服务层直接调用编译后的内部脚本，例如 `node dist/.../gen-proto.js`，不再依赖源码目录下的脚本文件。
- 校验必需文件时固定检查仓库内的 `protoc.exe`。

### 3.1 内部生成脚本迁移

内部生成脚本需要从源码外脚本迁移到 `src/`，目标是让运行时完全基于已发布的编译产物工作。

迁移目标：

- 删除 [scripts/gen-proto.mjs](/D:/workspace/mrdulin/dm-proto-to-ts/scripts/gen-proto.mjs)。
- 在 `src/` 下新增对应的 TypeScript 文件，用于承接 `protoc` 调用逻辑。
- 构建后在 `dist/` 中生成对应的可执行脚本，供 [src/services/proto-generator.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/services/proto-generator.ts) 调用。

这样运行链路会变为：

`CLI -> ProtoGeneratorService -> node dist/<internal-script>.js -> protoc.exe`

### 4. MCP 代码移除

删除 [src/tools/register-proto-tools.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/tools/register-proto-tools.ts)。

同步清理：

- [src/index.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/index.ts) 中的 MCP Server 启动逻辑。
- [package.json](/D:/workspace/mrdulin/dm-proto-to-ts/package.json) 中的 MCP 描述、关键词和依赖：
  - `@modelcontextprotocol/sdk`
  - `zod`

### 5. 包配置

[package.json](/D:/workspace/mrdulin/dm-proto-to-ts/package.json) 需要同步调整：

- `description` 改为 CLI 工具描述。
- `bin` 映射保留 `proto-to-ts`。
- `keywords` 去掉 `mcp`，保留 CLI 相关关键词。
- 删除 `_gen_proto` script。
- 从发布文件列表中移除 `scripts` 目录。
- `start`、`dev` 等脚本改成符合 CLI 场景的描述或执行方式。

如果 `dev` 仍有价值，可以保留为 `tsx src/index.ts`，便于本地调试 CLI。

### 6. README

[README.md](/D:/workspace/mrdulin/dm-proto-to-ts/README.md) 改写为 CLI 文档，至少包含：

- 包用途说明。
- 安装或 `npx` 使用方式。
- 平台限制：仅支持 Windows。
- 命令格式。
- `--help`、`--version` 示例。
- 常见错误说明。

需要删除：

- MCP Server 描述。
- 桌面应用配置示例。
- MCP Tool 调用示例。

## 错误处理

需要覆盖的错误场景：

1. 非 Windows 平台运行。
2. 缺少参数或参数数量不正确。
3. 输入文件不是 `.proto`。
4. 输入文件不存在。
5. 内置 `protoc.exe` 或内部生成脚本缺失。
6. `node dist/.../gen-proto.js` 执行失败。
7. 生成完成后找不到目标 `.ts` 文件。

错误输出原则：

- 先给出明确原因。
- 如与命令使用方式有关，补 usage。
- 保留底层 `stdout`/`stderr` 摘要，便于排查。

## 测试与验证

本次改造的最低验证集：

1. `npm run build`
2. `npm run typecheck`
3. `node dist/index.js --help`
4. `node dist/index.js --version`
5. `node dist/index.js <sample.proto> <temp-dir>`

如果仓库中没有现成的最小 `.proto` 文件，则在验证阶段临时创建一个最小示例文件用于运行验证；该文件是否保留，取决于是否需要作为文档示例或测试资产。

## 风险与边界

1. 当前生成流程仍保留“入口 + 服务层 + 内部脚本”的结构，但内部脚本会迁移到 `src/` 并随构建一起发布，因此运行时不再依赖源码目录。这是本次接受的最终形态，不继续下沉到单文件实现。
2. 仅支持 Windows，意味着 `npx` 在其他平台会立即失败。这需要在 README 中明确提示，避免误用。
3. 本次不新增自动化测试框架，因此验证主要依赖构建、类型检查和一次真实 CLI 运行。
