# proto-to-ts

一个基于 TypeScript 的 `stdio` MCP Server，用来读取用户指定的 `.proto` 文件路径，在临时 `proto/` 目录里执行项目自身的 `npm run _gen_proto`，并把生成的 TypeScript 文件写入用户指定目录。生成完成后会删除临时目录。

## 功能

- 接收 `.proto` 文件路径
- 接收用户指定的 TS 输出目录
- 内部固定执行 `npm run _gen_proto`
- 使用项目根目录下的 `protoc.exe` 与项目本地安装的 `ts-proto`
- 不在项目内部保留 `proto/` 或生成产物
- 将生成后的 `.ts` 文件写入用户指定目录

## 安装

```bash
npm install
npm run build
```

额外要求：

- Windows 环境下需要在项目根目录放置 `protoc.exe`

## 启动

```bash
npm start
```

开发模式：

```bash
npm run dev
```

## 可用工具

### `proto_to_ts`

输入参数：

- `proto_file_name`: `.proto` 文件地址，可以是绝对路径或相对路径
- `ts_output_dir`: 生成后的 `.ts` 文件输出目录

行为：

1. 读取用户指定的 `.proto` 文件
2. 在临时目录中执行内部固定命令 `npm run _gen_proto`
3. 直接调用 `<project-root>/protoc.exe`，配合 `ts-proto` 插件生成 `<name>.ts`
4. 把生成结果写入 `ts_output_dir`
5. 删除临时 `proto/` 和临时生成目录

## MCP 配置示例

```json
{
  "mcpServers": {
    "proto-to-ts": {
      "command": "node",
      "args": [
        "D:\\workspace\\innodealing\\dm-proto-to-ts\\dist\\index.js"
      ]
    }
  }
}
```
