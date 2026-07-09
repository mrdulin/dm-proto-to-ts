import { promises as fs } from "node:fs";
import path from "node:path";

import {
  CLI_BIN_NAME,
  DEFAULT_PROJECT_ROOT,
  PACKAGE_NAME,
  WINDOWS_ONLY_MESSAGE,
} from "./constants.js";
import { ProtoGeneratorService } from "./services/proto-generator.js";

function printUsage(): void {
  process.stdout.write(
    [
      "用法：",
      `  npx ${PACKAGE_NAME} <proto-file> <output-dir>`,
      `  ${CLI_BIN_NAME} <proto-file> <output-dir>`,
      "",
      "选项：",
      "  --help     显示帮助信息",
      "  --version  显示版本号",
    ].join("\n") + "\n",
  );
}

async function readPackageVersion(): Promise<string> {
  const packageJsonPath = path.join(DEFAULT_PROJECT_ROOT, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as {
    readonly version?: string;
  };

  if (!packageJson.version) {
    throw new Error("package.json 中缺少 version 字段。");
  }

  return packageJson.version;
}

function ensureWindows(): void {
  if (process.platform !== "win32") {
    throw new Error(WINDOWS_ONLY_MESSAGE);
  }
}

function isHelpFlag(argument: string | undefined): boolean {
  return argument === "--help" || argument === "-h";
}

function isVersionFlag(argument: string | undefined): boolean {
  return argument === "--version" || argument === "-v";
}

function failWithUsage(message: string): never {
  process.stderr.write(`${message}\n\n`);
  printUsage();
  process.exit(1);
}

async function main(): Promise<void> {
  ensureWindows();

  const args = process.argv.slice(2);

  if (args.length === 1 && isHelpFlag(args[0])) {
    printUsage();
    return;
  }

  if (args.length === 1 && isVersionFlag(args[0])) {
    process.stdout.write(`${await readPackageVersion()}\n`);
    return;
  }

  if (args.length !== 2) {
    failWithUsage("参数数量不正确。");
  }

  const [protoFileName, tsOutputDir] = args;
  const generatorService = new ProtoGeneratorService(DEFAULT_PROJECT_ROOT);
  const result = await generatorService.generateTypes({ protoFileName, tsOutputDir });

  process.stdout.write(
    [
      `Proto 文件：${result.protoFilePath}`,
      `输出目录：${result.outputDirectory}`,
      `输出文件：${result.outputFilePath}`,
    ].join("\n") + "\n",
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
