# proto-to-ts Node 16.13+ 兼容实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让 `@d-matrix/proto-to-ts` 在 Windows + Node.js 16.13 及以上环境中可通过 `npx` 运行，同时保证仓库本地开发、构建、测试流程兼容 Node.js 16.13。

**架构：** 保持现有 CLI 与生成链路不变，只调整工程兼容层。`package.json` 和 lockfile 负责声明与安装兼容性，测试从 `node:test` 切到 `mocha`，README 同步最低版本要求，并新增 Windows CI 矩阵持续验证 Node 16 / 18。

**技术栈：** TypeScript、Node.js ESM、npm、Mocha、GitHub Actions、`protoc.exe`、`ts-proto`

---

## 文件结构

- `package.json`
  责任：声明 Node 16.13+ 兼容基线，移除 `tsx`，切换 `dev` / `test` 脚本到 Node 16 可运行形式。
- `package-lock.json`
  责任：固化删除 `tsx`、新增 `mocha` 与类型依赖后的依赖树。
- `src/services/proto-generator.test.ts`
  责任：将现有生成逻辑测试从 `node:test` 改为 `mocha`，保持原有断言覆盖面。
- `README.md`
  责任：同步对外版本承诺、本地开发命令、测试命令。
- `.github/workflows/ci.yml`
  责任：在 Windows 环境下对 Node `16.13.0` 与 `18` 执行安装、构建、类型检查与测试。

### 任务 1：锁定 Node 16.13+ 工程基线

**文件：**
- 修改：`package.json`
- 修改：`package-lock.json`
- 参考：`docs/superpowers/specs/2026-07-09-node16-compat-design.md`
- 测试：`npm ci`
- 测试：`npm run build`

- [ ] **步骤 1：在 Node 16.13 环境复现当前工程兼容问题**

运行：

```bash
nvm use 16.13.0
npm ci
```

预期：

- 看到 `package.json` 的 `engines.node >=18` 与 `tsx` 的 Node 18+ 约束带来的兼容问题，作为后续修复基线。

- [ ] **步骤 2：修改 `package.json` 的 Node 版本、脚本与开发依赖**

将 `package.json` 的相关片段改为：

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "npm run build && node dist/index.js",
    "prepublishOnly": "npm run build",
    "postpublish": "echo \"wait for 3 seconds, then sync cnpm\" && npm run wait3s && npm run cnpm:sync",
    "start": "node dist/index.js",
    "test": "npm run build && mocha \"dist/**/*.test.js\"",
    "wait3s": "node -e \"setTimeout(() => process.exit(0), 3000)\"",
    "cnpm:sync": "cnpm sync %npm_package_name%",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "engines": {
    "node": ">=16.13"
  },
  "devDependencies": {
    "@types/mocha": "^10.0.0",
    "@types/node": "^16.18.0",
    "cnpm": "^9.4.0",
    "mocha": "^10.0.0",
    "typescript": "^5.8.3"
  }
}
```

要求：

- 删除 `tsx`
- 不改运行时依赖
- 不改 CLI `bin` 配置

- [ ] **步骤 3：重建 lockfile**

运行：

```bash
npm install
```

预期：

- `package-lock.json` 移除 `tsx`
- `package-lock.json` 新增 `mocha`、`@types/mocha`
- 锁文件与 `package.json` 保持一致

- [ ] **步骤 4：验证 Node 16.13 环境下可以完成安装与构建**

运行：

```bash
npm ci
npm run build
```

预期：

- 两条命令都返回退出码 `0`
- `dist/` 成功生成，不出现 Node 18+ 引擎报错

- [ ] **步骤 5：Commit**

```bash
git add package.json package-lock.json
git commit -m "build: support node 16.13 baseline"
```

### 任务 2：将测试从 `node:test` 切换到 `mocha`

**文件：**
- 修改：`src/services/proto-generator.test.ts`
- 修改：`package.json`
- 测试：`npm test`

- [ ] **步骤 1：先在 Node 16.13 环境运行当前测试命令确认旧链路不可用**

运行：

```bash
npm test
```

预期：

- 失败，原因是旧测试链路依赖 `node --test` 或 `node:test`。

- [ ] **步骤 2：将测试文件改写为 `mocha` 入口，但保留现有断言与场景**

将 `src/services/proto-generator.test.ts` 的结构调整为：

```ts
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { describe, it } from "mocha";
import os from "node:os";
import path from "node:path";

import { ProtoGeneratorService } from "./proto-generator.js";

async function withTempDirectory<T>(callback: (tempDirectory: string) => Promise<T>): Promise<T> {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "proto-to-ts-test-"));

  try {
    return await callback(tempDirectory);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

describe("ProtoGeneratorService", () => {
  it("generateTypes 支持同目录 proto import", async () => {
    await withTempDirectory(async (tempDirectory) => {
      const protoDirectory = path.join(tempDirectory, "proto");
      const outputDirectory = path.join(tempDirectory, "output");
      await fs.mkdir(protoDirectory, { recursive: true });

      await fs.writeFile(
        path.join(protoDirectory, "common.proto"),
        'syntax = "proto3";\npackage demo;\nmessage Common { string id = 1; }\n',
        "utf8",
      );
      await fs.writeFile(
        path.join(protoDirectory, "ping.proto"),
        'syntax = "proto3";\npackage demo;\nimport "common.proto";\nmessage Ping { Common data = 1; }\n',
        "utf8",
      );

      const service = new ProtoGeneratorService();
      const result = await service.generateTypes({
        protoFileName: path.join(protoDirectory, "ping.proto"),
        tsOutputDir: outputDirectory,
      });

      const generatedContent = await fs.readFile(result.outputFilePath, "utf8");
      assert.equal(result.outputFileName, "ping.ts");
      assert.match(generatedContent, /export interface Ping/);
      assert.match(generatedContent, /Common/);
    });
  });
});
```

要求：

- 三个现有测试场景全部保留
- `assert` 继续使用 `node:assert/strict`
- 不新增与 Node 16 兼容无关的测试

- [ ] **步骤 3：运行测试，确认切换后的测试链路可执行**

运行：

```bash
npm test
```

预期：

- `npm run build` 先成功
- `mocha "dist/**/*.test.js"` 成功执行
- 三个现有测试全部通过

- [ ] **步骤 4：补一次类型检查，确认 `mocha` 类型声明已接通**

运行：

```bash
npm run typecheck
```

预期：

- 返回退出码 `0`
- 不出现 `describe`、`it` 或测试文件导入的类型错误

- [ ] **步骤 5：Commit**

```bash
git add src/services/proto-generator.test.ts package.json package-lock.json
git commit -m "test: migrate suite to mocha for node16"
```

### 任务 3：新增 Windows Node 16 / 18 持续验证

**文件：**
- 创建：`.github/workflows/ci.yml`
- 参考：`.github/workflows/publish.yml`
- 测试：查看 workflow YAML 语法

- [ ] **步骤 1：新增 CI workflow 文件**

创建 `.github/workflows/ci.yml`：

```yml
name: CI

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  verify:
    runs-on: windows-latest
    strategy:
      fail-fast: false
      matrix:
        node-version:
          - "16.13.0"
          - "18"
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test
```

要求：

- 使用 Windows runner，因为 CLI 明确是 Windows-only
- 不改现有 `publish.yml`

- [ ] **步骤 2：人工检查 workflow 是否覆盖需求矩阵**

确认：

- Node `16.13.0` 与 `18` 都在矩阵内
- 顺序包含 `npm ci`、`build`、`typecheck`、`test`
- 不依赖 Linux 或 macOS runner

- [ ] **步骤 3：Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: verify node 16 and 18 on windows"
```

### 任务 4：同步 README 的版本承诺与开发说明

**文件：**
- 修改：`README.md`
- 测试：人工检查文档与脚本一致

- [ ] **步骤 1：更新平台要求与 `npx` 使用前提**

将 README 中平台要求改为：

```md
## 平台要求

- Windows
- Node.js 16.13 或更高版本
```

- [ ] **步骤 2：更新本地开发章节中的命令**

将 README 中本地开发片段改为：

```md
## 本地开发

    npm install
    npm run build
    npm run typecheck
    npm test

构建后可直接运行：

    node dist/index.js ./proto/ping.proto ./output
```

要求：

- 不再出现 `tsx`
- 文档中的测试命令与 `package.json` 完全一致

- [ ] **步骤 3：人工核对 README 与脚本、引擎声明一致**

确认：

- README 的最低 Node 版本是 `16.13+`
- `package.json` 的 `engines.node` 也是 `>=16.13`
- 文档中没有残留 `Node.js 18 或更高版本`

- [ ] **步骤 4：Commit**

```bash
git add README.md
git commit -m "docs: document node16 compatibility"
```

### 任务 5：执行 Node 16 / 18 的完整回归验证

**文件：**
- 验证：`package.json`
- 验证：`src/services/proto-generator.test.ts`
- 验证：`README.md`
- 验证：`.github/workflows/ci.yml`

- [ ] **步骤 1：在 Node 16.13 环境执行完整命令集**

运行：

```bash
nvm use 16.13.0
npm ci
npm run build
npm run typecheck
npm test
```

预期：

- 四条命令全部成功

- [ ] **步骤 2：在 Node 16.13 环境验证 CLI 帮助与版本输出**

运行：

```bash
node dist/index.js --help
node dist/index.js --version
```

预期：

- `--help` 输出用法并返回退出码 `0`
- `--version` 输出版本号并返回退出码 `0`

- [ ] **步骤 3：在 Node 16.13 环境做一次真实生成验证**

运行：

```powershell
$tmp = Join-Path $env:TEMP ("proto-to-ts-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tmp | Out-Null
$protoFile = Join-Path $tmp "ping.proto"
$outDir = Join-Path $tmp "out"
Set-Content -LiteralPath $protoFile -Encoding UTF8 -Value @'
syntax = "proto3";
package demo;
message Ping {
  string id = 1;
}
'@
node dist/index.js $protoFile $outDir
Get-Content (Join-Path $outDir "ping.ts")
```

预期：

- CLI 输出输入文件、输出目录、输出文件路径
- `ping.ts` 存在
- 文件内容中包含 `export interface Ping`

- [ ] **步骤 4：在 Node 18 环境重复核心验证，确认没有向后破坏**

运行：

```bash
nvm use 18
npm ci
npm run build
npm run typecheck
npm test
```

预期：

- 四条命令全部成功

- [ ] **步骤 5：复查差异，只保留兼容 Node 16 所需改动**

运行：

```bash
git status --short
git diff -- package.json package-lock.json src/services/proto-generator.test.ts README.md .github/workflows/ci.yml
```

预期：

- 只有计划内文件发生变更
- 没有顺手重构 CLI 运行时代码

- [ ] **步骤 6：Commit**

```bash
git add package.json package-lock.json src/services/proto-generator.test.ts README.md .github/workflows/ci.yml
git commit -m "feat: support node 16.13 for cli and tooling"
```
