import { z } from "zod";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { INTERNAL_GENERATION_COMMAND } from "../constants.js";
import { ProtoGeneratorService } from "../services/proto-generator.js";

const protoGenerationResultSchema = {
  project_root: z.string(),
  proto_file_path: z.string(),
  output_directory: z.string(),
  output_file_path: z.string(),
  output_file_name: z.string(),
  output_file_size_bytes: z.number().nullable(),
  stdout: z.string(),
  stderr: z.string(),
};

export function registerProtoTools(server: McpServer, service: ProtoGeneratorService): void {
  server.registerTool(
    "proto_to_ts",
    {
      title: "Proto To TypeScript",
      description: `读取用户给定的 .proto 文件地址，执行当前 mcp-server 项目内置的 ${INTERNAL_GENERATION_COMMAND}，并把生成的 TypeScript 文件写入用户指定的输出目录。

Args:
  - proto_file_name: .proto 文件地址，可以是绝对路径或相对路径
  - ts_output_dir: 生成后的 .ts 文件输出目录

Returns:
  - project_root: 实际执行生成命令的项目根目录
  - proto_file_path: 实际读取的 .proto 文件绝对路径
  - output_directory: 实际写入的输出目录绝对路径
  - output_file_path: 生成后的 .ts 文件绝对路径
  - output_file_name: 生成出的 TypeScript 文件名
  - output_file_size_bytes: 输出文件大小
  - stdout/stderr: 命令输出摘要

Use when:
  - 你已经有现成的 .proto 文件，只需要生成对应的 TypeScript 文件
  - 你希望把生成结果写入指定目录，而不是保存在 mcp-server 项目内部

Do not use when:
  - 你想传入 .proto 源码文本
  - 你想执行任意 shell 命令`,
      inputSchema: {
        proto_file_name: z.string().min(1, "proto_file_name 不能为空"),
        ts_output_dir: z.string().min(1, "ts_output_dir 不能为空"),
      },
      outputSchema: protoGenerationResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ proto_file_name, ts_output_dir }) => {
      try {
        const result = await service.generateTypes({
          protoFileName: proto_file_name,
          tsOutputDir: ts_output_dir,
        });

        const output = {
          project_root: result.projectRoot,
          proto_file_path: result.protoFilePath,
          output_directory: result.outputDirectory,
          output_file_path: result.outputFilePath,
          output_file_name: result.outputFileName,
          output_file_size_bytes: result.outputFileSizeBytes,
          stdout: result.stdout,
          stderr: result.stderr,
        };

        const summaryLines = [
          `生成命令：${INTERNAL_GENERATION_COMMAND}`,
          `Proto 文件：${output.proto_file_path}`,
          `输出目录：${output.output_directory}`,
          `输出文件：${output.output_file_path}`,
        ];

        if (output.output_file_size_bytes !== null) {
          summaryLines.push(`文件大小：${output.output_file_size_bytes} bytes`);
        }

        if (output.stdout) {
          summaryLines.push(`stdout:\n${output.stdout}`);
        }

        if (output.stderr) {
          summaryLines.push(`stderr:\n${output.stderr}`);
        }

        return {
          content: [
            {
              type: "text",
              text: summaryLines.join("\n\n"),
            },
          ],
          structuredContent: output,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `proto_to_ts 执行失败：\n${message}`,
            },
          ],
        };
      }
    },
  );
}
