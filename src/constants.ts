import path from "node:path";
import { fileURLToPath } from "node:url";

export const SERVER_NAME = "proto-to-ts";
export const SERVER_VERSION = "0.1.0";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

export const DEFAULT_PROJECT_ROOT =
  process.env.PROTO_TS_PROJECT_ROOT ?? path.resolve(currentDirectory, "..");

export const INTERNAL_GENERATION_COMMAND = "npm run _gen_proto";

export const MAX_OUTPUT_CHARS = 6000;
