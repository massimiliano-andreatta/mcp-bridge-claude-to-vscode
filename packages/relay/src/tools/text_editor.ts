export const textEditorTool = {
  name: "text_editor",
  description:
    "A text editor tool that provides file manipulation capabilities using VSCode's native APIs:\n- view: Read file contents with optional line range\n- str_replace: Replace text in file\n- create: Create new file\n- insert: Insert text at specific line\n- undo_edit: Restore from backup\n\nCode Editing Tips:\n- VSCode may automatically prune unused imports when saving. To prevent this, make sure the imported type is\n  actually used in your code before adding the import.",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        enum: ["view", "str_replace", "create", "insert", "undo_edit"],
      },
      path: {
        type: "string",
        description: "File path to operate on",
      },
      view_range: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: [
          {
            type: "number",
          },
          {
            type: "number",
          },
        ],
        description: "Optional [start, end] line numbers for view command (1-indexed, -1 for end)",
      },
      old_str: {
        type: "string",
        description: "Text to replace (required for str_replace command)",
      },
      new_str: {
        type: "string",
        description: "New text to insert (required for str_replace and insert commands)",
      },
      file_text: {
        type: "string",
        description: "Content for new file (required for create command)",
      },
      insert_line: {
        type: "number",
        description: "Line number to insert after (required for insert command)",
      },
      skip_dialog: {
        type: "boolean",
        description: "Skip confirmation dialog (for testing only)",
      },
    },
    required: ["command", "path"],
    additionalProperties: false,
    $schema: "http://json-schema.org/draft-07/schema#",
  },
};
