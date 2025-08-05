export const restartDebugSessionTool = {
  name: "restart_debug_session",
  description: "Restart a debug session by stopping it and then starting it with the provided configuration.",
  inputSchema: {
    type: "object",
    properties: {
      workspaceFolder: {
        type: "string",
        description: "The workspace folder where the debug session should start.",
      },
      configuration: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Type of the debugger (e.g., 'node', 'python', etc.).",
          },
          request: {
            type: "string",
            description: "Type of debug request (e.g., 'launch' or 'attach').",
          },
          name: {
            type: "string",
            description: "Name of the debug session.",
          },
        },
        required: ["type", "request", "name"],
        additionalProperties: true,
        description: "The debug configuration object.",
      },
    },
    required: ["workspaceFolder", "configuration"],
    additionalProperties: false,
    $schema: "http://json-schema.org/draft-07/schema#",
  },
};
