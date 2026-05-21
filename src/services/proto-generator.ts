import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_PROJECT_ROOT,
  INTERNAL_GENERATION_COMMAND,
  MAX_OUTPUT_CHARS,
} from "../constants.js";
import type { CommandExecutionResult, GenerationResult } from "../types.js";

function trimOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) {
    return output;
  }

  return `${output.slice(0, MAX_OUTPUT_CHARS)}\n...<truncated>`;
}

function resolveCommand(): { command: string; args: string[] } {
  return process.platform === "win32"
    ? { command: "cmd.exe", args: ["/c", "npm.cmd", "run", "_gen_proto"] }
    : { command: "npm", args: ["run", "_gen_proto"] };
}

function resolveProtoInputPath(protoFileName: string): string {
  const resolvedPath = path.resolve(protoFileName);
  if (path.extname(resolvedPath).toLowerCase() !== ".proto") {
    throw new Error("proto_file_name 必须是 .proto 文件地址。");
  }

  return resolvedPath;
}

function resolveOutputDirectory(tsOutputDir: string): string {
  if (!tsOutputDir.trim()) {
    throw new Error("ts_output_dir 不能为空。");
  }

  return path.resolve(tsOutputDir);
}

async function assertProjectIsUsable(projectRoot: string): Promise<void> {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const generatorScriptPath = path.join(projectRoot, "scripts", "gen-proto.mjs");
  const protocPath =
    process.platform === "win32"
      ? path.join(projectRoot, "protoc.exe")
      : path.join(projectRoot, "protoc");

  for (const filePath of [packageJsonPath, generatorScriptPath, protocPath]) {
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`目标项目缺少必需文件：${filePath}`);
    }
  }
}

async function assertProtoInputExists(protoFilePath: string): Promise<void> {
  let stats;
  try {
    stats = await fs.stat(protoFilePath);
  } catch {
    throw new Error(`找不到 proto 文件：${protoFilePath}`);
  }

  if (!stats.isFile()) {
    throw new Error(`proto_file_name 不是有效文件：${protoFilePath}`);
  }
}

async function executeCommand(input: {
  projectRoot: string;
  protoDirectory: string;
  outputDirectory: string;
}): Promise<CommandExecutionResult> {
  const resolved = resolveCommand();

  return new Promise<CommandExecutionResult>((resolve, reject) => {
    const child = spawn(resolved.command, resolved.args, {
      cwd: input.projectRoot,
      env: {
        ...process.env,
        PROTO_TS_INPUT_DIR: input.protoDirectory,
        PROTO_TS_OUTPUT_DIR: input.outputDirectory,
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? -1,
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
      });
    });
  });
}

export class ProtoGeneratorService {
  public readonly projectRoot: string;

  public constructor(projectRoot = DEFAULT_PROJECT_ROOT) {
    this.projectRoot = projectRoot;
  }

  public async generateTypes(input: {
    protoFileName: string;
    tsOutputDir: string;
  }): Promise<GenerationResult> {
    const protoFilePath = resolveProtoInputPath(input.protoFileName);
    const outputDirectory = resolveOutputDirectory(input.tsOutputDir);

    await assertProjectIsUsable(this.projectRoot);
    await assertProtoInputExists(protoFilePath);

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "proto-to-ts-mcp-"));
    const tempProtoDirectory = path.join(tempRoot, "proto");
    const tempOutputDirectory = path.join(tempRoot, "generated");
    const protoBaseName = path.basename(protoFilePath);
    const tempProtoFilePath = path.join(tempProtoDirectory, protoBaseName);
    const outputFileName = `${path.basename(protoFilePath, ".proto")}.ts`;
    const tempOutputFilePath = path.join(tempOutputDirectory, outputFileName);
    const outputFilePath = path.join(outputDirectory, outputFileName);

    try {
      await fs.mkdir(tempProtoDirectory, { recursive: true });
      await fs.mkdir(tempOutputDirectory, { recursive: true });
      await fs.mkdir(outputDirectory, { recursive: true });
      await fs.copyFile(protoFilePath, tempProtoFilePath);

      const commandResult = await executeCommand({
        projectRoot: this.projectRoot,
        protoDirectory: tempProtoDirectory,
        outputDirectory: tempOutputDirectory,
      });

      if (commandResult.exitCode !== 0) {
        throw new Error(
          [
            `执行 ${INTERNAL_GENERATION_COMMAND} 失败，exitCode=${commandResult.exitCode}。`,
            commandResult.stderr ? `stderr:\n${commandResult.stderr}` : "",
            commandResult.stdout ? `stdout:\n${commandResult.stdout}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        );
      }

      let outputFileSizeBytes: number | null = null;

      try {
        await fs.copyFile(tempOutputFilePath, outputFilePath);
        const stats = await fs.stat(outputFilePath);
        outputFileSizeBytes = stats.size;
      } catch {
        throw new Error(`生成完成后未找到目标 TS 文件：${tempOutputFilePath}`);
      }

      return {
        projectRoot: this.projectRoot,
        protoFilePath,
        outputDirectory,
        outputFilePath,
        outputFileName,
        outputFileSizeBytes,
        stdout: commandResult.stdout,
        stderr: commandResult.stderr,
      };
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }
}
