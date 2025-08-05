export const stopDebugSessionTool = {
  name: "stop_debug_session",
  description: "Stop all debug sessions that match the provided session name.",
  inputSchema: {
    type: "object",
    properties: {
      sessionName: {
        type: "string",
        description: "The name of the debug session(s) to stop.",
      },
    },
    required: ["sessionName"],
    additionalProperties: false,
    $schema: "http://json-schema.org/draft-07/schema#",
  },
};
