export const focusEditorTool = {
  name: "focus_editor",
  description:
    "Open the specified file in the VSCode editor and navigate to a specific line and column.\nUse this tool to bring a file into focus and position the editor's cursor where desired.\nNote: This tool operates on the editor visual environment so that the user can see the file. It does not return the file contents in the tool call result.",
  inputSchema: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "The absolute path to the file to focus in the editor.",
      },
      line: {
        type: "integer",
        minimum: 0,
        default: 0,
        description: "The line number to navigate to (default: 0).",
      },
      column: {
        type: "integer",
        minimum: 0,
        default: 0,
        description: "The column position to navigate to (default: 0).",
      },
      startLine: {
        type: "integer",
        minimum: 0,
        description: "The starting line number for highlighting.",
      },
      startColumn: {
        type: "integer",
        minimum: 0,
        description: "The starting column number for highlighting.",
      },
      endLine: {
        type: "integer",
        minimum: 0,
        description: "The ending line number for highlighting.",
      },
      endColumn: {
        type: "integer",
        minimum: 0,
        description: "The ending column number for highlighting.",
      },
    },
    required: ["filePath"],
    additionalProperties: false,
    $schema: "http://json-schema.org/draft-07/schema#",
  },
};
