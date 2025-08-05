import * as path from "path";
import * as vscode from "vscode";
import { z } from "zod";
import { DiffViewProvider } from "../utils/DiffViewProvider";
import { ConfirmationUI } from "../utils/confirmation_ui";
import { OperationType, OperationContext } from "../utils/AutoApprovalManager";

// Zod schema definition
export const textEditorSchema = z.object({
  command: z.enum(["view", "str_replace", "create", "insert", "undo_edit"]),
  path: z.string().describe("File path to operate on"),
  view_range: z.tuple([z.number(), z.number()]).optional().describe("Optional [start, end] line numbers for view command (1-indexed, -1 for end)"),
  old_str: z.string().optional().describe("Text to replace (required for str_replace command)"),
  new_str: z.string().optional().describe("New text to insert (required for str_replace and insert commands)"),
  file_text: z.string().optional().describe("Content for new file (required for create command)"),
  insert_line: z.number().optional().describe("Line number to insert after (required for insert command)"),
  skip_dialog: z.boolean().optional().describe("Skip confirmation dialog (for testing only)"),
});

type TextEditorParams = z.infer<typeof textEditorSchema>;

interface TextEditorResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

// Class to manage backups and diff views
class EditorManager {
  private static instance: EditorManager;
  private diffViewProvider: DiffViewProvider;

  private constructor() {
    console.log("EditorManager: Initializing...");
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    this.diffViewProvider = new DiffViewProvider(workspaceRoot);
  }

  static getInstance(): EditorManager {
    if (!EditorManager.instance) {
      EditorManager.instance = new EditorManager();
    }
    return EditorManager.instance;
  }

  // Resolve path
  private resolvePath(filePath: string): string {
    console.log("EditorManager: Resolving path:", filePath);
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      return path.join(workspaceRoot, filePath);
    }

    return path.resolve(filePath);
  }

  // Get file URI
  private getFileUri(filePath: string): vscode.Uri {
    const resolvedPath = this.resolvePath(filePath);
    console.log("EditorManager: Getting file URI:", resolvedPath);
    return vscode.Uri.file(resolvedPath);
  }

  // Show confirmation prompt
  private async showPersistentConfirmation(message: string, approveLabel: string, denyLabel: string, filePath?: string, operationType?: OperationType): Promise<{ approved: boolean; feedback?: string }> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        throw new Error("No active text editor");
      }

      console.log(`[EditorManager] Using ConfirmationUI for confirmation`);

      // Create operation context for auto-approval
      let operationContext: OperationContext | undefined;
      if (operationType && filePath) {
        operationContext = {
          operation: operationType,
          filePath: filePath,
          description: message,
          isDestructive: operationType === OperationType.WRITE,
        };
      }

      // Confirm using ConfirmationUI
      const result = await ConfirmationUI.confirm(message, "", approveLabel, denyLabel, operationContext);
      if (result === "Approve") {
        return { approved: true };
      } else {
        // Treat anything other than "Deny" as user feedback
        return {
          approved: false,
          feedback: result !== "Deny" ? result : undefined,
        };
      }
    } catch (error) {
      console.error("Error showing confirmation:", error);
      return { approved: false };
    }
  }

  // Create parent directory
  private async ensureParentDirectory(filePath: string): Promise<void> {
    console.log("EditorManager: Ensuring parent directory exists:", filePath);
    const uri = this.getFileUri(filePath);
    const parentDir = path.dirname(uri.fsPath);
    const parentUri = vscode.Uri.file(parentDir);

    try {
      await vscode.workspace.fs.stat(parentUri);
    } catch {
      // If the parent directory does not exist, create it
      console.log("EditorManager: Creating parent directory:", parentDir);
      await vscode.workspace.fs.createDirectory(parentUri);
    }
  }

  async viewFile(filePath: string, viewRange?: [number, number]): Promise<TextEditorResult> {
    console.log("EditorManager: Viewing file:", filePath);
    try {
      const uri = this.getFileUri(filePath);

      // Add confirmation for reading files
      const confirmResult = await this.showPersistentConfirmation(`Do you want to view the file at "${filePath}"?`, "View File", "Cancel", uri.fsPath, OperationType.READ);

      if (!confirmResult.approved) {
        return {
          content: [{ type: "text", text: "File view cancelled by user." }],
          isError: true,
        };
      }

      try {
        const stat = await vscode.workspace.fs.stat(uri);

        // Check if the path is a directory
        if (stat.type === vscode.FileType.Directory) {
          console.log("EditorManager: Path is a directory, listing contents:", uri.fsPath);

          try {
            const entries = await vscode.workspace.fs.readDirectory(uri);

            // Sort entries: directories first, then files, both alphabetically
            entries.sort((a, b) => {
              const aIsDir = a[1] & vscode.FileType.Directory;
              const bIsDir = b[1] & vscode.FileType.Directory;

              if (aIsDir && !bIsDir) return -1;
              if (!aIsDir && bIsDir) return 1;
              return a[0].localeCompare(b[0]);
            });

            // Format the directory listing
            const lines = [`Directory listing for: ${uri.fsPath}`, ""];

            for (const [name, type] of entries) {
              const isDir = type & vscode.FileType.Directory;
              const isSymlink = type & vscode.FileType.SymbolicLink;

              let prefix = "";
              let suffix = "";

              if (isDir) {
                prefix = "d ";
                suffix = "/";
              } else if (isSymlink) {
                prefix = "l ";
                suffix = "@";
              } else {
                prefix = "- ";
              }

              lines.push(`${prefix}${name}${suffix}`);
            }

            return {
              content: [{ type: "text", text: lines.join("\n") }],
              isError: false,
            };
          } catch (dirError) {
            const errorMessage = dirError instanceof Error ? dirError.message : "Unknown directory reading error occurred";
            return {
              content: [
                {
                  type: "text",
                  text: `Error reading directory: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }
        }
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `File does not exist at path: ${uri.fsPath}`,
            },
          ],
          isError: true,
        };
      }

      const doc = await vscode.workspace.openTextDocument(uri);
      let content: string;

      if (viewRange) {
        const [start, end] = viewRange;
        const startLine = Math.max(0, start - 1); // 1-indexed to 0-indexed
        const endLine = end === -1 ? doc.lineCount : end;
        const range = new vscode.Range(new vscode.Position(startLine, 0), new vscode.Position(endLine, 0));
        content = doc.getText(range);
      } else {
        content = doc.getText();
      }

      return {
        content: [{ type: "text", text: content }],
        isError: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      return {
        content: [{ type: "text", text: `Error reading file: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  async replaceText(filePath: string, oldStr: string, newStr: string, skipDialog?: boolean): Promise<TextEditorResult> {
    console.log("EditorManager: Replacing text in file:", filePath);
    try {
      const uri = this.getFileUri(filePath);

      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `File does not exist at path: ${uri.fsPath}`,
            },
          ],
          isError: true,
        };
      }

      // Perform replacement
      console.log("EditorManager: Reading file content");
      const doc = await vscode.workspace.openTextDocument(uri);
      const content = doc.getText();
      if (!content.includes(oldStr)) {
        return {
          content: [
            {
              type: "text",
              text: `Text to replace '${oldStr}' not found in the file`,
            },
          ],
          isError: true,
        };
      }
      const newContent = content.replaceAll(oldStr, newStr);
      console.log("EditorManager: Text replacement - Old:", oldStr, "New:", newStr);

      console.log("EditorManager: Content length - Original:", content.length, "New:", newContent.length);

      // Important: Set editType before calling open
      this.diffViewProvider.editType = "modify";

      // Open the file using DiffViewProvider
      console.log("EditorManager: Opening file in DiffViewProvider");
      if (!this.diffViewProvider.isEditing) {
        await this.diffViewProvider.open(uri.fsPath);
      }

      // Apply changes
      console.log("EditorManager: Updating content in DiffViewProvider");
      await this.diffViewProvider.update(newContent, true);
      await this.diffViewProvider.scrollToFirstDiff();

      // Skip dialog during test execution
      console.log("EditorManager: Checking approval");
      let confirmResult;
      if (skipDialog) {
        confirmResult = { approved: true };
      } else {
        confirmResult = await this.showPersistentConfirmation("Do you want to apply these changes?", "Apply Changes", "Discard Changes", uri.fsPath, OperationType.WRITE);
      }

      if (!confirmResult.approved) {
        console.log("EditorManager: Changes rejected");
        await this.diffViewProvider.revertChanges();

        // Include user feedback if provided
        const feedbackMessage = confirmResult.feedback ? `Changes were rejected by the user with feedback: ${confirmResult.feedback}` : "Changes were rejected by the user";

        return {
          content: [{ type: "text", text: feedbackMessage }],
          isError: true,
        };
      }

      console.log("EditorManager: Saving changes");
      const { newProblemsMessage, userEdits, userFeedback } = await this.diffViewProvider.saveChanges();

      // Format content based on whether feedback is present
      const feedbackText = userFeedback ? `\nUser feedback: ${userFeedback}` : "";

      if (userEdits) {
        return {
          content: [
            {
              type: "text",
              text: `User modified the changes. Please review the updated content.${newProblemsMessage || ""}${feedbackText}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Text replacement completed successfully${newProblemsMessage || ""}${feedbackText}`,
          },
        ],
      };
    } catch (error) {
      console.error("EditorManager: Error in replaceText:", error);
      await this.diffViewProvider.revertChanges();
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      return {
        content: [{ type: "text", text: `Error replacing text: ${errorMessage}` }],
        isError: true,
      };
    } finally {
      await this.diffViewProvider.reset();
    }
  }

  async createFile(filePath: string, fileText: string, skipDialog?: boolean): Promise<TextEditorResult> {
    console.log("EditorManager: Creating file:", filePath);
    try {
      const uri = this.getFileUri(filePath);

      try {
        await vscode.workspace.fs.stat(uri);
        return {
          content: [{ type: "text", text: "File already exists" }],
          isError: true,
        };
      } catch {
        // If the file does not exist, continue
      }

      // Create parent directory
      console.log("EditorManager: Creating parent directory");
      await this.ensureParentDirectory(filePath);

      // Important: Set editType before calling open
      this.diffViewProvider.editType = "create";

      console.log("EditorManager: Opening file in DiffViewProvider");
      if (!this.diffViewProvider.isEditing) {
        await this.diffViewProvider.open(uri.fsPath);
      }

      console.log("EditorManager: Updating content in DiffViewProvider");
      console.log("EditorManager: File text length:", fileText.length);
      await this.diffViewProvider.update(fileText, true);
      await this.diffViewProvider.scrollToFirstDiff();

      // Skip dialog during test execution
      console.log("EditorManager: Checking approval");
      let confirmResult;
      if (skipDialog) {
        confirmResult = { approved: true };
      } else {
        confirmResult = await this.showPersistentConfirmation("Do you want to create this file?", "Apply Changes", "Discard Changes", uri.fsPath, OperationType.WRITE);
      }

      if (!confirmResult.approved) {
        console.log("EditorManager: File creation cancelled");
        await this.diffViewProvider.revertChanges();

        // Include user feedback if provided
        const feedbackMessage = confirmResult.feedback ? `File creation was cancelled by the user with feedback: ${confirmResult.feedback}` : "File creation was cancelled by the user";

        return {
          content: [{ type: "text", text: feedbackMessage }],
          isError: true,
        };
      }

      console.log("EditorManager: Saving changes");
      const { newProblemsMessage, userEdits, userFeedback } = await this.diffViewProvider.saveChanges();

      // Format content based on whether feedback is present
      const feedbackText = userFeedback ? `\nUser feedback: ${userFeedback}` : "";

      if (userEdits) {
        return {
          content: [
            {
              type: "text",
              text: `User modified the new file content. Please review the changes.${newProblemsMessage || ""}${feedbackText}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `File created successfully${newProblemsMessage || ""}${feedbackText}`,
          },
        ],
      };
    } catch (error) {
      console.error("EditorManager: Error in createFile:", error);
      await this.diffViewProvider.revertChanges();
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      return {
        content: [{ type: "text", text: `Error creating file: ${errorMessage}` }],
        isError: true,
      };
    } finally {
      await this.diffViewProvider.reset();
    }
  }

  async insertText(filePath: string, insertLine: number, newStr: string, skipDialog?: boolean): Promise<TextEditorResult> {
    console.log("EditorManager: Inserting text in file:", filePath);
    try {
      const uri = this.getFileUri(filePath);

      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `File does not exist at path: ${uri.fsPath}`,
            },
          ],
          isError: true,
        };
      }

      // Important: Set editType before calling open
      this.diffViewProvider.editType = "modify";

      console.log("EditorManager: Opening file in DiffViewProvider");
      if (!this.diffViewProvider.isEditing) {
        await this.diffViewProvider.open(uri.fsPath);
      }

      console.log("EditorManager: Reading file content");
      const doc = await vscode.workspace.openTextDocument(uri);
      const content = doc.getText();
      const lines = content.split("\n");
      const lineIndex = Math.max(0, insertLine); // 0-based index
      lines.splice(lineIndex, 0, newStr);
      const newContent = lines.join("\n");

      console.log("EditorManager: Updating content in DiffViewProvider");
      console.log("EditorManager: Content length - Original:", content.length, "New:", newContent.length);
      await this.diffViewProvider.update(newContent, true);
      await this.diffViewProvider.scrollToFirstDiff();

      // Skip dialog during test execution
      console.log("EditorManager: Checking approval");
      let confirmResult;
      if (skipDialog) {
        confirmResult = { approved: true };
      } else {
        confirmResult = await this.showPersistentConfirmation("Do you want to insert this text?", "Apply Changes", "Discard Changes", uri.fsPath, OperationType.WRITE);
      }

      if (!confirmResult.approved) {
        console.log("EditorManager: Text insertion cancelled");
        await this.diffViewProvider.revertChanges();

        // Include user feedback if provided
        const feedbackMessage = confirmResult.feedback ? `Text insertion was cancelled by the user with feedback: ${confirmResult.feedback}` : "Text insertion was cancelled by the user";

        return {
          content: [{ type: "text", text: feedbackMessage }],
          isError: true,
        };
      }

      console.log("EditorManager: Saving changes");
      const { newProblemsMessage, userEdits, userFeedback } = await this.diffViewProvider.saveChanges();

      // Format content based on whether feedback is present
      const feedbackText = userFeedback ? `\nUser feedback: ${userFeedback}` : "";

      if (userEdits) {
        return {
          content: [
            {
              type: "text",
              text: `User modified the inserted content. Please review the changes.${newProblemsMessage || ""}${feedbackText}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Text insertion completed successfully${newProblemsMessage || ""}${feedbackText}`,
          },
        ],
      };
    } catch (error) {
      console.error("EditorManager: Error in insertText:", error);
      await this.diffViewProvider.revertChanges();
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      return {
        content: [{ type: "text", text: `Error inserting text: ${errorMessage}` }],
        isError: true,
      };
    } finally {
      await this.diffViewProvider.reset();
    }
  }

  async undoEdit(): Promise<TextEditorResult> {
    console.log("EditorManager: Undoing edit");
    try {
      if (!this.diffViewProvider.isEditing) {
        return {
          content: [{ type: "text", text: "No active edit session to undo" }],
          isError: true,
        };
      }

      await this.diffViewProvider.revertChanges();
      return {
        content: [{ type: "text", text: "Undo completed successfully" }],
      };
    } catch (error) {
      console.error("EditorManager: Error in undoEdit:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      return {
        content: [{ type: "text", text: `Error undoing changes: ${errorMessage}` }],
        isError: true,
      };
    } finally {
      await this.diffViewProvider.reset();
    }
  }
}

// Main tool handler
export async function textEditorTool(params: TextEditorParams): Promise<TextEditorResult> {
  console.log("textEditorTool: Starting with params:", params);
  const editor = EditorManager.getInstance();

  switch (params.command) {
    case "view": {
      return await editor.viewFile(params.path, params.view_range);
    }
    case "str_replace": {
      if (!params.old_str || !params.new_str) {
        return {
          content: [
            {
              type: "text",
              text: "old_str and new_str parameters are required",
            },
          ],
          isError: true,
        };
      }
      return await editor.replaceText(params.path, params.old_str, params.new_str, params.skip_dialog);
    }
    case "create": {
      if (!params.file_text) {
        return {
          content: [{ type: "text", text: "file_text parameter is required" }],
          isError: true,
        };
      }
      return await editor.createFile(params.path, params.file_text, params.skip_dialog);
    }
    case "insert": {
      if (params.insert_line === undefined || !params.new_str) {
        return {
          content: [
            {
              type: "text",
              text: "insert_line and new_str parameters are required",
            },
          ],
          isError: true,
        };
      }
      return await editor.insertText(params.path, params.insert_line, params.new_str, params.skip_dialog);
    }
    case "undo_edit": {
      return await editor.undoEdit();
    }
    default:
      return {
        content: [{ type: "text", text: "Invalid command" }],
        isError: true,
      };
  }
}
