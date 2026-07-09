import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const projectRoot = path.resolve(currentDirectory, "..");
const protoInputEnv = process.env.PROTO_TS_INPUT_DIR;
const protoOutputEnv = process.env.PROTO_TS_OUTPUT_DIR;
const protoEntryEnv = process.env.PROTO_TS_ENTRY_FILE;

if (!protoInputEnv || !protoOutputEnv || !protoEntryEnv) {
  throw new Error("PROTO_TS_INPUT_DIR、PROTO_TS_OUTPUT_DIR 和 PROTO_TS_ENTRY_FILE 是必需的。");
}

const protoDirectory = path.resolve(protoInputEnv);
const outputDirectory = path.resolve(protoOutputEnv);
const entryProtoFilePath = path.resolve(protoDirectory, protoEntryEnv);
const protocBinary = path.join(projectRoot, "protoc.exe");
const tsProtoPlugin = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  "protoc-gen-ts_proto.cmd",
);

async function run(): Promise<void> {
  await fs.access(protocBinary);
  await fs.access(tsProtoPlugin);
  await fs.access(entryProtoFilePath);

  await fs.mkdir(outputDirectory, { recursive: true });

  const args = [
    `--plugin=protoc-gen-ts_proto=${tsProtoPlugin}`,
    `--ts_proto_out=${outputDirectory}`,
    `--proto_path=${protoDirectory}`,
    "--ts_proto_opt=forceLong=string",
    "--ts_proto_opt=outputEncodeMethods=decode-only",
    "--ts_proto_opt=outputJsonMethods=false",
    "--ts_proto_opt=outputPartialMethods=false",
    "--ts_proto_opt=esModuleInterop=true",
    entryProtoFilePath,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(protocBinary, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`protoc 执行失败，退出码：${code ?? -1}`));
    });
  });
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
