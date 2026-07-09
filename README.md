# proto-to-ts

`@d-matrix/proto-to-ts` 是一个仅支持 Windows 的 Node CLI，用于将单个 `.proto` 文件生成到指定输出目录中的 TypeScript 文件。

## 平台要求

- Windows
- Node.js 16.13 或更高版本

## 使用方式

推荐直接通过 `npx` 执行：

```bash
npx @d-matrix/proto-to-ts ./proto/ping.proto ./output
```

如果已经全局安装，也可以直接调用二进制命令：

```bash
proto-to-ts ./proto/ping.proto ./output
```

如果是本地安装，推荐使用 `npx` 或 `npm exec`：

```bash
npx @d-matrix/proto-to-ts ./proto/ping.proto ./output
npm exec proto-to-ts ./proto/ping.proto ./output
```

## 命令格式

```bash
proto-to-ts <proto-file> <output-dir>
```

参数说明：

- `proto-file`：输入的 `.proto` 文件路径，支持相对路径和绝对路径
- `output-dir`：生成后的 `.ts` 文件输出目录

## CLI 选项

查看帮助：

```bash
npx @d-matrix/proto-to-ts --help
```

查看版本：

```bash
npx @d-matrix/proto-to-ts --version
```

## 运行结果

命令执行成功后，会输出：

- 实际读取的 Proto 文件绝对路径
- 实际输出目录绝对路径
- 最终生成的 TypeScript 文件绝对路径

生成规则：

- 输入 `ping.proto`
- 输出文件名固定为 `ping.ts`

## 工作方式

工具内部会：

1. 校验输入的 `.proto` 文件路径
2. 创建临时 Proto 输入目录和临时生成目录
3. 调用包内置的 `protoc.exe` 和本地 `ts-proto`
4. 将生成后的 `.ts` 文件复制到你指定的输出目录
5. 清理临时目录

## 常见错误

### 当前版本仅支持 Windows 平台

当前版本不会在 macOS 或 Linux 上运行。请在 Windows 环境中使用。

### 参数数量不正确

请确认命令格式为：

```bash
npx @d-matrix/proto-to-ts <proto-file> <output-dir>
```

### 输入文件不是 `.proto`

请确认第一个参数指向一个真实存在的 `.proto` 文件。

### 找不到生成结果

通常意味着 `protoc.exe` 执行失败，或 `.proto` 文件内容本身存在问题。请根据命令输出中的错误信息排查。

## 本地开发

```bash
npm install
npm run build
npm run typecheck
npm test
```

构建后可直接运行：

```bash
node dist/index.js ./proto/ping.proto ./output
```
