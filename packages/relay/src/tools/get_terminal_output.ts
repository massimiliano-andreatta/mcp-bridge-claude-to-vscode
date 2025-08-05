export const getTerminalOutputTool = {
  name: "get_terminal_output",
  description: "Retrieve the output from a specific terminal by its ID.\nThis tool allows you to check the current or historical output of a terminal,\nwhich is particularly useful when working with long-running commands or\ncommands started in background mode with the execute_command tool.",
  inputSchema: {
    type: "object",
    properties: {
      terminalId: {
        type: ["string", "number"],
        description: "The ID of the terminal to get output from",
      },
      maxLines: {
        type: "number",
        default: 1000,
        description: "Maximum number of lines to retrieve (default: 1000)",
      },
    },
    required: ["terminalId"],
    additionalProperties: false,
    $schema: "http://json-schema.org/draft-07/schema#",
  },
};
