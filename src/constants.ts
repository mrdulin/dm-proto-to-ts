import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_NAME = "@d-matrix/proto-to-ts";
export const CLI_BIN_NAME = "proto-to-ts";
export const WINDOWS_ONLY_MESSAGE = "当前版本仅支持 Windows 平台。";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

export const DEFAULT_PROJECT_ROOT =
  process.env.PROTO_TS_PROJECT_ROOT ?? path.resolve(currentDirectory, "..");

export const MAX_OUTPUT_CHARS = 6000;
