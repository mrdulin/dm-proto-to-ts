import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { DEFAULT_PROJECT_ROOT, SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { ProtoGeneratorService } from "./services/proto-generator.js";
import { registerProtoTools } from "./tools/register-proto-tools.js";

async function main(): Promise<void> {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const generatorService = new ProtoGeneratorService(DEFAULT_PROJECT_ROOT);
  registerProtoTools(server, generatorService);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `[${SERVER_NAME}] connected. projectRoot=${generatorService.projectRoot}\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`[${SERVER_NAME}] startup failed\n${message}\n`);
  process.exit(1);
});
