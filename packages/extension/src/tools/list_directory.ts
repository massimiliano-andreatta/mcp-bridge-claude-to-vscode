import * as ignore from "ignore";
import * as path from "path";
import * as vscode from "vscode";
import { z } from "zod";

// Zod schema definition
export const listDirectorySchema = z.object({
  path: z.string().describe("Directory path to list"),
  depth: z.number().int().min(1).optional().describe("Maximum depth for traversal (default: unlimited)"),
  include_hidden: z.boolean().optional().describe("Include hidden files/directories (default: false)"),
});

type ListDirectoryParams = z.infer<typeof listDirectorySchema>;

interface ListDirectoryResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown; // Add index signature expected by MCP Bridge
}

interface TreeNode {
  name: string;
  isDirectory: boolean;
  children: TreeNode[];
}

/**
 * A tool to display a directory tree.
 * It displays the structure of a specified directory, taking .gitignore patterns into account.
 */
export async function listDirectoryTool(params: ListDirectoryParams): Promise<ListDirectoryResult> {
  try {
    const resolvedPath = resolvePath(params.path);
    const uri = vscode.Uri.file(resolvedPath);

    try {
      const stats = await vscode.workspace.fs.stat(uri);
      if (!(stats.type & vscode.FileType.Directory)) {
        return {
          content: [{ type: "text", text: `${resolvedPath} is not a directory` }],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: "Directory is empty or does not exist" }],
        isError: true,
      };
    }

    // Load .gitignore
    const ignorePatterns = await loadGitignorePatterns(resolvedPath);
    const ig = ignore.default().add(ignorePatterns);

    // Build the directory tree
    const tree = await buildDirectoryTree(resolvedPath, path.basename(resolvedPath), 1, params.depth || Number.MAX_SAFE_INTEGER, params.include_hidden || false, ig);

    // Convert the tree to text for display
    const treeText = generateTreeText(tree);

    return {
      content: [{ type: "text", text: treeText }],
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Failed to list directory: ${errorMessage}` }],
      isError: true,
    };
  }
}

/**
 * Resolves a path.
 * @param dirPath The path to resolve.
 * @returns The absolute path.
 */
function resolvePath(dirPath: string): string {
  if (path.isAbsolute(dirPath)) {
    return dirPath;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    return path.join(workspaceRoot, dirPath);
  }

  return path.resolve(dirPath);
}

/**
 * Loads .gitignore patterns.
 * @param dirPath The directory path.
 * @returns An array of .gitignore patterns.
 */
async function loadGitignorePatterns(dirPath: string): Promise<string[]> {
  const patterns: string[] = [];

  try {
    // Search for .gitignore from the root directory
    let currentDir = dirPath;

    while (currentDir) {
      const gitignorePath = path.join(currentDir, ".gitignore");
      const uri = vscode.Uri.file(gitignorePath);

      try {
        const content = await vscode.workspace.fs.readFile(uri);
        const lines = Buffer.from(content).toString("utf-8").split("\n");

        const validPatterns = lines.filter((line) => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith("#");
        });

        patterns.push(...validPatterns);
      } catch {
        // If .gitignore does not exist, ignore it
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    return patterns;
  } catch (error) {
    console.error("Error loading .gitignore patterns:", error);
    return [];
  }
}

/**
 * Builds a directory tree.
 * @param fullPath The full path.
 * @param nodeName The node name.
 * @param currentDepth The current depth.
 * @param maxDepth The maximum depth.
 * @param includeHidden Whether to include hidden files.
 * @param ignorer The ignore pattern checker.
 * @returns The tree node.
 */
async function buildDirectoryTree(fullPath: string, nodeName: string, currentDepth: number, maxDepth: number, includeHidden: boolean, ignorer: ignore.Ignore): Promise<TreeNode> {
  const uri = vscode.Uri.file(fullPath);
  const root: TreeNode = {
    name: nodeName,
    isDirectory: true,
    children: [],
  };

  if (currentDepth > maxDepth) {
    return root;
  }

  try {
    // Get entries in the directory
    const entries = await vscode.workspace.fs.readDirectory(uri);

    // Sort by file name (directories first)
    const sortedEntries = entries.sort((a, b) => {
      const aIsDir = !!(a[1] & vscode.FileType.Directory);
      const bIsDir = !!(b[1] & vscode.FileType.Directory);

      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;

      return a[0].localeCompare(b[0]);
    });

    for (const [name, type] of sortedEntries) {
      // Skip hidden files (configurable)
      if (!includeHidden && name.startsWith(".")) {
        continue;
      }

      const entryPath = path.join(fullPath, name);
      const relativePath = path.relative(path.dirname(fullPath), entryPath);

      // Check if it matches a .gitignore pattern
      if (ignorer.ignores(relativePath)) {
        continue;
      }

      const isDirectory = !!(type & vscode.FileType.Directory);

      if (isDirectory) {
        // Recursively scan subdirectories
        const childNode = await buildDirectoryTree(entryPath, name, currentDepth + 1, maxDepth, includeHidden, ignorer);
        root.children.push(childNode);
      } else {
        // Add a file node
        root.children.push({
          name,
          isDirectory: false,
          children: [],
        });
      }
    }

    return root;
  } catch (error) {
    console.error(`Error reading directory ${fullPath}:`, error);
    return root;
  }
}

/**
 * Converts a tree node to a text representation.
 * @param node The tree node.
 * @param prefix The line prefix.
 * @param isLast Whether it is the last child node.
 * @returns The tree text.
 */
function generateTreeText(node: TreeNode, prefix = "", isLast = true): string {
  let result = prefix;

  if (prefix !== "") {
    result += isLast ? "└── " : "├── ";
  }

  result += `${node.name}${node.isDirectory ? "/" : ""}\n`;

  if (node.children.length > 0) {
    const newPrefix = prefix + (isLast ? "    " : "│   ");

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const isLastChild = i === node.children.length - 1;
      result += generateTreeText(child, newPrefix, isLastChild);
    }
  }

  return result;
}
