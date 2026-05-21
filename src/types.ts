export interface CommandExecutionResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface GenerationResult {
  readonly projectRoot: string;
  readonly protoFilePath: string;
  readonly outputDirectory: string;
  readonly outputFilePath: string;
  readonly outputFileName: string;
  readonly outputFileSizeBytes: number | null;
  readonly stdout: string;
  readonly stderr: string;
}
