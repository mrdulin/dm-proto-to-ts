# proto-to-ts Node 16.13+ 兼容设计

**目标**

让用户可以在 Windows + Node.js 16.13 及以上环境中通过 `npx @d-matrix/proto-to-ts <proto-file> <output-dir>` 正常安装并运行 CLI，同时确保仓库本地开发、构建、测试流程也兼容 Node.js 16.13。

**范围**

- 允许修改：
  - `package.json`
  - `package-lock.json`
  - `tsconfig.json`
  - `README.md`
  - `src/`
  - `.github/workflows/`
- 允许调整开发依赖和测试方案。
- 不修改 CLI 对外参数和输出协议。

**非目标**

- 不支持 Node.js 16.0 到 16.12。
- 不改变仅支持 Windows 的平台限制。
- 不新增 CLI 参数。
- 不重构 `protoc.exe` 与 `ts-proto` 的生成链路。
- 不为了兼容 Node 16 顺手调整业务行为或输出格式。

## 现状

当前仓库对 Node 18+ 存在多处显式或隐式依赖：

1. [package.json](/D:/workspace/mrdulin/dm-proto-to-ts/package.json) 的 `engines.node` 目前为 `>=18`。
2. [README.md](/D:/workspace/mrdulin/dm-proto-to-ts/README.md) 的平台要求写的是 `Node.js 18 或更高版本`。
3. `dev` 脚本依赖 `tsx`，而当前锁定版本要求 Node 18+。
4. [src/services/proto-generator.test.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/services/proto-generator.test.ts) 使用 `node:test`，现有 `npm test` 也通过 `node --test` 执行，这条测试链路不适合作为 Node 16 基线。
5. 发布 workflow 使用 Node 24，但这只影响发包环境，不直接阻塞用户在 Node 16 上使用已发布 CLI。

这意味着问题的重点不是 CLI 业务逻辑本身，而是把“包声明、开发工具、测试入口、验证流程”整体降到 Node 16.13+ 可用。

## 方案选择

### 方案 A：兼容基线设为 Node 16.13+

- 将对外与对内兼容基线统一设为 `>=16.13`。
- 保留当前 ESM CLI 结构与 `node:` 前缀导入。
- 替换掉 Node 18+ 专属开发链与测试链。

优点：

- 满足用户使用 `npx` 的目标。
- 改动集中在工程配置和测试基础设施。
- 不需要改写 CLI 主流程。

缺点：

- 需要替换当前测试入口。
- 需要重新生成 lockfile。

### 方案 B：兼容基线设为所有 Node 16.x

- 把目标放宽到 `>=16.0.0`。
- 对所有运行时 API、编译目标和依赖版本做更严格回退。

优点：

- 覆盖面更大。

缺点：

- 需要更广泛的兼容性审计。
- 为了覆盖 `16.0` 到 `16.12`，可能引入额外降级成本。
- 超出当前需求所需的最小改动。

### 方案 C：用户侧支持 Node 16，仓库开发仍停留在 Node 18+

- 对外只放宽 `engines`，本地开发与测试继续使用高版本 Node。

优点：

- 修改最少。

缺点：

- 与需求不符。
- 会留下“用户能跑、仓库自己不能在 Node 16 验证”的断层。

**推荐方案：方案 A。**

理由：它是满足需求的最小闭环，既覆盖用户使用场景，也覆盖开发、构建、测试与验证，不需要为了兼容更老 16.x 引入额外复杂度。

## 目标设计

### 1. 兼容基线

[package.json](/D:/workspace/mrdulin/dm-proto-to-ts/package.json) 中的 `engines.node` 调整为 `>=16.13`。

[README.md](/D:/workspace/mrdulin/dm-proto-to-ts/README.md) 中所有 Node 版本描述同步改为：

- Windows
- Node.js 16.13 或更高版本

兼容承诺明确为：

- 用户可以在 Windows + Node 16.13+ 上通过 `npx @d-matrix/proto-to-ts` 直接运行。
- 仓库维护者可以在 Node 16.13+ 上执行 `npm install`、`npm run build`、`npm run typecheck`、`npm test`。

### 2. 运行时代码边界

当前运行时代码包括：

- [bin/proto-to-ts.js](/D:/workspace/mrdulin/dm-proto-to-ts/bin/proto-to-ts.js)
- [src/index.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/index.ts)
- [src/constants.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/constants.ts)
- [src/gen-proto.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/gen-proto.ts)
- [src/services/proto-generator.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/services/proto-generator.ts)

本次不调整 CLI 参数解析、不调整内部生成流程、不改 `node:` 前缀导入方式。原因是这些代码在 Node 16.13+ 下可以继续工作，真正不兼容的是工程配套设施，而不是业务入口本身。

对 [tsconfig.json](/D:/workspace/mrdulin/dm-proto-to-ts/tsconfig.json) 的处理原则：

- 优先保持现有 `module` 与 `moduleResolution` 配置不变。
- 重新评估 `target` 是否需要下调。
- 只有当编译产物中出现 Node 16.13 无法执行的语法时，才调整 `target`。

这条原则的目标是避免无意义地扩大改动面。

### 3. 开发链调整

当前 [package.json](/D:/workspace/mrdulin/dm-proto-to-ts/package.json) 的 `dev` 脚本依赖 `tsx`，而当前锁定版本要求 Node 18+。这会导致 Node 16 环境下 `npm install` 后开发脚本不可用，甚至可能在安装阶段就出现引擎冲突提示。

调整原则：

1. 移除 `tsx` 依赖。
2. `dev` 脚本改成仅基于 Node 16.13+ 和现有编译产物可运行的形式。
3. 优先使用“先构建，再运行 `dist/index.js`”的保守方案，而不是引入新的即时执行器。

推荐落地形态：

- `build` 继续使用 `tsc -p tsconfig.json`
- `dev` 调整为 `npm run build && node dist/index.js`
- `start` 继续指向 `node dist/index.js`

这样可以确保开发链没有额外 Node 18+ 依赖，也不会为了保留“热执行 TypeScript”能力而新增工具。

### 4. 测试方案替换

当前测试文件 [src/services/proto-generator.test.ts](/D:/workspace/mrdulin/dm-proto-to-ts/src/services/proto-generator.test.ts) 使用 `node:test`，`npm test` 依赖 `node --test`。这不适合作为 Node 16.13 的测试基线。

设计要求：

1. 保留现有测试覆盖的场景，不缩减断言内容。
2. 不自建简陋脚本式 test runner。
3. 使用 Node 16 兼容的最小测试框架替换 `node:test`。
4. 继续让测试以编译后的 `dist` 产物为入口，避免测试运行时再引入额外 TypeScript 执行器。

选型结论：

- 增加 `mocha` 作为开发测试依赖，用于替换 `node:test`。
- 测试脚本调整为 `npm run build && mocha "dist/**/*.test.js"` 这类基于编译产物的执行方式。
- 测试文件中的 `import test from "node:test"` 改成 `mocha` 对应写法，`assert` 继续保留 `node:assert/strict`。

这样既能兼容 Node 16，又能继续验证真实编译产物。

### 5. 依赖与锁文件

[package-lock.json](/D:/workspace/mrdulin/dm-proto-to-ts/package-lock.json) 需要随依赖变更重生成。

依赖调整边界：

- 允许删除 `tsx`
- 允许新增 `mocha` 作为 Node 16 兼容的开发测试依赖
- 不新增运行时依赖
- 不升级 `ts-proto`、`typescript`、`cnpm` 等与当前目标无关的核心依赖，除非实现阶段发现某个版本本身无法在 Node 16.13 安装或运行

如果实现阶段发现 `@types/node` 当前版本与 Node 16 目标存在明显不匹配，需要把它调整到更贴近 Node 16 的版本范围，但这只作为兼容修正，不作为顺手升级或降级依赖的借口。

### 6. CI 与发布

[.github/workflows/publish.yml](/D:/workspace/mrdulin/dm-proto-to-ts/.github/workflows/publish.yml) 的高版本 Node 可以保留，因为发布机版本高于运行基线并不构成问题。

但仓库需要新增或调整一个验证 workflow，明确覆盖：

- Node 16
- Node 18

验证内容至少包括：

1. `npm ci`
2. `npm run build`
3. `npm run typecheck`
4. `npm test`

如果当前仓库还没有合适的通用 CI workflow，则新增一个面向 PR 或 push 的校验 workflow；如果已有相近 workflow，则在原有基础上扩展矩阵。

原则是把“Node 16 兼容”从文档承诺变成可持续验证的约束。

### 7. 文档同步

[README.md](/D:/workspace/mrdulin/dm-proto-to-ts/README.md) 需要同步更新以下内容：

1. 平台要求中的 Node 版本改为 16.13+
2. 本地开发章节中的命令与脚本说明改为新的开发链
3. 如测试命令发生变化，文档中的验证方式同步调整

不需要新增冗长的兼容性说明表，只需要把用户真正关心的最低版本写清楚。

## 错误处理与行为约束

本次设计不改变以下行为：

1. 非 Windows 平台直接失败。
2. CLI 参数数量校验逻辑不变。
3. 输入文件扩展名、存在性、复制输出失败等错误语义不变。
4. 成功输出中的字段顺序和核心内容不变。

Node 16 兼容改造只允许触碰工程层配置和测试设施；如果实现中发现需要修改运行时代码，必须以“修复 Node 16 实际不兼容点”为理由，而不是为了风格统一或结构优化。

## 测试与验证

实现完成后的最低验证集：

1. 在 Node 16.13+ 环境执行 `npm ci`
2. 在 Node 16.13+ 环境执行 `npm run build`
3. 在 Node 16.13+ 环境执行 `npm run typecheck`
4. 在 Node 16.13+ 环境执行 `npm test`
5. 在 Node 16.13+ 环境执行 `npx @d-matrix/proto-to-ts --help` 或等价的本地产物入口验证
6. 在 Node 16.13+ 环境执行一次最小 `.proto` 到 `.ts` 的真实生成
7. 在 Node 18 环境重复执行 `npm ci`、`npm run build`、`npm test`，确认没有向后破坏

如果当前本地环境不在 Node 16，需要在实现阶段通过 CI、版本切换工具或单独验证环境补齐这部分证据。

## 风险与边界

1. 测试框架替换会导致测试文件改写，但这是兼容 Node 16 的必要改动，不应顺手扩写更多测试主题。
2. 仅把 `engines` 改成 `>=16.13` 并不够，必须同时清掉 `tsx` 和 `node:test` 这两条高版本依赖链，否则文档承诺会失真。
3. 如果实现阶段发现某个开发依赖虽然能安装，但在 Node 16 下存在运行时兼容问题，优先替换该依赖而不是提高兼容基线。
4. 发布 workflow 保持高版本 Node 不构成问题，但前提是单独存在 Node 16 校验流程；否则兼容承诺不可持续。
