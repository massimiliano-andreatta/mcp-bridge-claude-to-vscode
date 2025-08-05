export const executeCommandTool = {
  name: "execute_command",
  description:
    "Execute a command in a VSCode integrated terminal with proper shell integration.\nThis tool provides detailed output and exit status information, and supports:\n- Custom working directory\n- Shell integration for reliable output capture\n- Output compression for large outputs\n- Detailed exit status reporting\n- Flag for potentially destructive commands (potentiallyDestructive: false to skip confirmation for read-only commands)",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to execute",
      },
      customCwd: {
        type: "string",
        description: "Optional custom working directory for command execution",
      },
      potentiallyDestructive: {
        type: "boolean",
        default: true,
        description:
          "Flag indicating if the command is potentially destructive or modifying. Default is true. Set to false for read-only commands (like grep, find, ls) to skip user confirmation. Commands that could modify files or system state should keep this as true. Note: User can override this behavior with the mcpServer.confirmNonDestructiveCommands setting.",
      },
      background: {
        type: "boolean",
        default: false,
        description: "Flag indicating if the command should run in the background without waiting for completion. When true, the tool will return immediately after starting the command. Default is false, which means the tool will wait for command completion.",
      },
      timeout: {
        type: "number",
        default: 300000,
        description: "Timeout in milliseconds after which the command execution will be considered complete for reporting purposes. Does not actually terminate the command. Default is 300000 (5 minutes).",
      },
    },
    required: ["command"],
    additionalProperties: false,
    $schema: "http://json-schema.org/draft-07/schema#",
  },
};
