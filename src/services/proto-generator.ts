import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { DEFAULT_PROJECT_ROOT, MAX_OUTPUT_CHARS } from '../constants.js';
import type { CommandExecutionResult, GenerationResult } from '../types.js';

const PROTO_IMPORT_PATTERN = /^\s*import(?:\s+(?:weak|public))?\s+"([^"]+\.proto)"\s*;/gim;

function trimOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) {
    return output;
  }

  return `${output.slice(0, MAX_OUTPUT_CHARS)}\n...<truncated>`;
}

function resolveGenerationScriptPath(projectRoot: string): string {
  return path.join(projectRoot, 'dist', 'gen-proto.js');
}

function resolveCommand(projectRoot: string): {
  command: string;
  args: string[];
  displayCommand: string;
} {
  const generationScriptPath = resolveGenerationScriptPath(projectRoot);

  return {
    command: process.execPath,
    args: [generationScriptPath],
    displayCommand: `node ${path.relative(projectRoot, generationScriptPath)}`,
  };
}

function resolveProtoInputPath(protoFileName: string): string {
  const resolvedPath = path.resolve(protoFileName);
  if (path.extname(resolvedPath).toLowerCase() !== '.proto') {
    throw new Error('proto_file_name 必须是 .proto 文件地址。');
  }

  return resolvedPath;
}

function resolveOutputDirectory(tsOutputDir: string): string {
  if (!tsOutputDir.trim()) {
    throw new Error('ts_output_dir 不能为空。');
  }

  return path.resolve(tsOutputDir);
}

function resolveOutputFileName(protoFilePath: string): string {
  return `${path.parse(protoFilePath).name}.ts`;
}

function resolveGeneratedRelativePath(entryRelativeProtoPath: string): string {
  return `${entryRelativeProtoPath.slice(0, -path.extname(entryRelativeProtoPath).length)}.ts`;
}

function resolveGeneratedOutputCandidates(
  tempOutputDirectory: string,
  entryRelativeProtoPath: string,
): string[] {
  return [
    path.join(tempOutputDirectory, resolveGeneratedRelativePath(entryRelativeProtoPath)),
    path.join(tempOutputDirectory, entryRelativeProtoPath),
  ];
}

function resolveImportCandidates(importPath: string, fromFilePath: string): string[] {
  const candidates = [path.resolve(path.dirname(fromFilePath), importPath)];

  const normalizedImportPath = importPath.split('/').join(path.sep);
  if (!candidates.includes(path.resolve(path.dirname(fromFilePath), normalizedImportPath))) {
    candidates.push(path.resolve(path.dirname(fromFilePath), normalizedImportPath));
  }

  return candidates;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveImportedProtoPath(importPath: string, fromFilePath: string): Promise<string | null> {
  for (const candidatePath of resolveImportCandidates(importPath, fromFilePath)) {
    if (await pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function findCommonDirectory(filePaths: string[]): string {
  if (filePaths.length === 0) {
    throw new Error('filePaths 不能为空。');
  }

  const [firstFilePath, ...otherFilePaths] = filePaths.map((filePath) => path.resolve(filePath));
  const firstSegments = path.dirname(firstFilePath).split(path.sep);
  let commonLength = firstSegments.length;

  for (const filePath of otherFilePaths) {
    const currentSegments = path.dirname(filePath).split(path.sep);
    commonLength = Math.min(commonLength, currentSegments.length);

    for (let index = 0; index < commonLength; index += 1) {
      if (firstSegments[index]?.toLowerCase() !== currentSegments[index]?.toLowerCase()) {
        commonLength = index;
        break;
      }
    }
  }

  if (commonLength === 0) {
    return path.parse(firstFilePath).root;
  }

  return firstSegments.slice(0, commonLength).join(path.sep);
}

async function collectProtoDependencyPaths(entryProtoFilePath: string): Promise<string[]> {
  const collectedPaths = new Set<string>();
  const queue = [entryProtoFilePath];

  while (queue.length > 0) {
    const currentFilePath = queue.shift();
    if (!currentFilePath) {
      continue;
    }

    const normalizedCurrentFilePath = path.resolve(currentFilePath);
    if (collectedPaths.has(normalizedCurrentFilePath)) {
      continue;
    }

    collectedPaths.add(normalizedCurrentFilePath);

    const fileContent = await fs.readFile(normalizedCurrentFilePath, 'utf8');
    const importMatches = fileContent.matchAll(PROTO_IMPORT_PATTERN);

    for (const match of importMatches) {
      const importedProtoPath = await resolveImportedProtoPath(match[1], normalizedCurrentFilePath);
      if (importedProtoPath && !collectedPaths.has(importedProtoPath)) {
        queue.push(importedProtoPath);
      }
    }
  }

  return Array.from(collectedPaths);
}

async function stageProtoInputs(
  entryProtoFilePath: string,
  tempProtoDirectory: string,
): Promise<{
  entryRelativeProtoPath: string;
}> {
  const dependencyPaths = await collectProtoDependencyPaths(entryProtoFilePath);
  const protoSourceRoot = findCommonDirectory(dependencyPaths);
  const entryRelativeProtoPath = path.relative(protoSourceRoot, entryProtoFilePath);

  for (const sourceFilePath of dependencyPaths) {
    const relativeSourcePath = path.relative(protoSourceRoot, sourceFilePath);
    const targetFilePath = path.join(tempProtoDirectory, relativeSourcePath);
    await fs.mkdir(path.dirname(targetFilePath), { recursive: true });
    await fs.copyFile(sourceFilePath, targetFilePath);
  }

  return { entryRelativeProtoPath };
}

async function resolveGeneratedOutputFilePath(
  tempOutputDirectory: string,
  entryRelativeProtoPath: string,
): Promise<string | null> {
  for (const candidatePath of resolveGeneratedOutputCandidates(
    tempOutputDirectory,
    entryRelativeProtoPath,
  )) {
    if (await pathExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

async function assertProjectIsUsable(projectRoot: string): Promise<void> {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const generatorScriptPath = resolveGenerationScriptPath(projectRoot);
  const protocPath = path.join(projectRoot, 'protoc.exe');

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
  entryRelativeProtoPath: string;
}): Promise<CommandExecutionResult & { displayCommand: string }> {
  const resolved = resolveCommand(input.projectRoot);

  return new Promise<CommandExecutionResult & { displayCommand: string }>((resolve, reject) => {
    const child = spawn(resolved.command, resolved.args, {
      cwd: input.projectRoot,
      env: {
        ...process.env,
        PROTO_TS_INPUT_DIR: input.protoDirectory,
        PROTO_TS_OUTPUT_DIR: input.outputDirectory,
        PROTO_TS_ENTRY_FILE: input.entryRelativeProtoPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? -1,
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
        displayCommand: resolved.displayCommand,
      });
    });
  });
}

export class ProtoGeneratorService {
  public readonly projectRoot: string;

  public constructor(projectRoot = DEFAULT_PROJECT_ROOT) {
    this.projectRoot = projectRoot;
  }

  public async generateTypes(input: { protoFileName: string; tsOutputDir: string }): Promise<GenerationResult> {
    const protoFilePath = resolveProtoInputPath(input.protoFileName);
    const outputDirectory = resolveOutputDirectory(input.tsOutputDir);

    await assertProjectIsUsable(this.projectRoot);
    await assertProtoInputExists(protoFilePath);

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'proto-to-ts-'));
    const tempProtoDirectory = path.join(tempRoot, 'proto');
    const tempOutputDirectory = path.join(tempRoot, 'generated');
    const outputFileName = resolveOutputFileName(protoFilePath);
    const outputFilePath = path.join(outputDirectory, outputFileName);

    try {
      await fs.mkdir(tempProtoDirectory, { recursive: true });
      await fs.mkdir(tempOutputDirectory, { recursive: true });
      await fs.mkdir(outputDirectory, { recursive: true });
      const { entryRelativeProtoPath } = await stageProtoInputs(protoFilePath, tempProtoDirectory);

      const commandResult = await executeCommand({
        projectRoot: this.projectRoot,
        protoDirectory: tempProtoDirectory,
        outputDirectory: tempOutputDirectory,
        entryRelativeProtoPath,
      });

      if (commandResult.exitCode !== 0) {
        throw new Error(
          [
            `执行 ${commandResult.displayCommand} 失败，exitCode=${commandResult.exitCode}。`,
            commandResult.stderr ? `stderr:\n${commandResult.stderr}` : '',
            commandResult.stdout ? `stdout:\n${commandResult.stdout}` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        );
      }

      let outputFileSizeBytes: number | null = null;
      const tempOutputFilePath = await resolveGeneratedOutputFilePath(
        tempOutputDirectory,
        entryRelativeProtoPath,
      );

      if (!tempOutputFilePath) {
        throw new Error(
          `生成完成后未找到目标 TS 文件：${path.join(
            tempOutputDirectory,
            resolveGeneratedRelativePath(entryRelativeProtoPath),
          )}`,
        );
      }

      try {
        await fs.copyFile(tempOutputFilePath, outputFilePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`复制生成结果到目标目录失败：${message}`);
      }

      try {
        const stats = await fs.stat(outputFilePath);
        outputFileSizeBytes = stats.size;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`读取生成结果文件信息失败：${message}`);
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
