import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ProtoGeneratorService } from "./services/proto-generator.js";

async function withTempDirectory<T>(callback: (tempDirectory: string) => Promise<T>): Promise<T> {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "proto-to-ts-test-"));

  try {
    return await callback(tempDirectory);
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

test("generateTypes 支持同目录 proto import", async () => {
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

test("generateTypes 支持大小写混合的 .proto 扩展名", async () => {
  await withTempDirectory(async (tempDirectory) => {
    const protoFilePath = path.join(tempDirectory, "PING.PROTO");
    const outputDirectory = path.join(tempDirectory, "output");

    await fs.writeFile(
      protoFilePath,
      'syntax = "proto3";\npackage demo;\nmessage Ping {}\n',
      "utf8",
    );

    const service = new ProtoGeneratorService();
    const result = await service.generateTypes({
      protoFileName: protoFilePath,
      tsOutputDir: outputDirectory,
    });

    assert.equal(result.outputFileName, "PING.ts");
    assert.equal(path.basename(result.outputFilePath), "PING.ts");
    await fs.access(result.outputFilePath);
  });
});

test("generateTypes 在复制生成结果失败时保留真实错误信息", async () => {
  await withTempDirectory(async (tempDirectory) => {
    const protoFilePath = path.join(tempDirectory, "ping.proto");
    const outputDirectory = path.join(tempDirectory, "output");
    const conflictingPath = path.join(outputDirectory, "ping.ts");

    await fs.writeFile(
      protoFilePath,
      'syntax = "proto3";\npackage demo;\nmessage Ping {}\n',
      "utf8",
    );
    await fs.mkdir(conflictingPath, { recursive: true });

    const service = new ProtoGeneratorService();

    await assert.rejects(
      () =>
        service.generateTypes({
          protoFileName: protoFilePath,
          tsOutputDir: outputDirectory,
        }),
      (error: unknown) => {
        assert(error instanceof Error);
        assert.match(error.message, /复制生成结果到目标目录失败/);
        assert.doesNotMatch(error.message, /生成完成后未找到目标 TS 文件/);
        return true;
      },
    );
  });
});
