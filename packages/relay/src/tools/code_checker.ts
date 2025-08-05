export const codeCheckerTool = {
  name: "code_checker",
  description: "Retrieve diagnostics from VSCode's language services for the active workspace.\nUse this tool after making changes to any code in the filesystem to ensure no new\nerrors were introduced, or when requested by the user.",
  inputSchema: {
    type: "object",
    properties: {
      severityLevel: {
        type: "string",
        enum: ["Error", "Warning", "Information", "Hint"],
        default: "Warning",
        description: "Minimum severity level for checking issues: 'Error', 'Warning', 'Information', or 'Hint'.",
      },
    },
    additionalProperties: false,
    $schema: "http://json-schema.org/draft-07/schema#",
  },
};
