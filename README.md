# proto-to-ts

A TypeScript `stdio` MCP server that reads a user-provided `.proto` file path, runs `npm run _gen_proto` in a temporary `proto/` directory, and writes the generated TypeScript file into a user-specified output directory. Temporary proto and generated directories are removed after completion.

## Install

```bash
npm install @d-matrix/proto-to-ts
```

Requirements:

- Node.js 18 or newer
- `protoc.exe` placed in the package root on Windows deployments

## Features

- Accepts a `.proto` file path
- Accepts a user-specified TypeScript output directory
- Internally runs `npm run _gen_proto`
- Uses `protoc.exe` from the package root together with local `ts-proto`
- Does not keep `proto/` or generated artifacts inside the project
- Writes the generated `.ts` file into the requested output directory

## Local Development

```bash
npm install
npm run build
npm start
```

Development mode:

```bash
npm run dev
```

## MCP Tool

### `proto_to_ts`

Input arguments:

- `proto_file_name`: `.proto` file path, absolute or relative
- `ts_output_dir`: output directory for the generated `.ts` file

Behavior:

1. Reads the user-provided `.proto` file
2. Runs the internal `npm run _gen_proto` command in temporary directories
3. Calls `<package-root>/protoc.exe` with the `ts-proto` plugin to generate `<name>.ts`
4. Writes the result into `ts_output_dir`
5. Deletes the temporary `proto/` and generated directories

## MCP Client Example

```json
{
  "mcpServers": {
    "proto-to-ts": {
      "command": "node",
      "args": [
        "C:\\path\\to\\node_modules\\@d-matrix\\proto-to-ts\\dist\\index.js"
      ],
      "cwd": "C:\\path\\to\\node_modules\\@d-matrix\\proto-to-ts"
    }
  }
}
```

## Example Tool Call

```json
{
  "name": "proto_to_ts",
  "arguments": {
    "proto_file_name": "C:\\path\\to\\proto\\ping.proto",
    "ts_output_dir": "C:\\path\\to\\output"
  }
}
```

The tool returns the final output file path and writes the generated TypeScript file into the requested directory.
