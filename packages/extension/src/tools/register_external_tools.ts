import { Tool } from "@modelcontextprotocol/sdk/types";
import * as vscode from "vscode";
import { ToolRegistry } from "../mcp-server";

// Array of tool names to register as a whitelist
// const ALLOWED_TOOLS = [
//   'copilot_semanticSearch',
//   'copilot_searchWorkspaceSymbols',
//   'copilot_listCodeUsages',
//   'copilot_vscodeAPI',
//   'copilot_findFiles',
//   'copilot_findTextInFiles',
//   'copilot_readFile',
//   'copilot_listDirectory',
//   'copilot_getErrors',
//   // 'copilot_readProjectStructure', // No InputSchema
//   'copilot_getChangedFiles',
//   // 'copilot_testFailure', // No InputSchema
//   'copilot_runTests',
//   'copilot_runVsCodeTask'
//   // below are not allowed without invocationToken
//   // 'copilot_runInTerminal',
//   // 'copilot_getTerminalOutput',
//   // 'copilot_getTerminalSelection',
//   // 'copilot_getTerminalLastCommand',
//   // 'copilot_editFile'
// ];

const notAllowedTools = [
  // No Input Schema
  "copilot_readProjectStructure",
  "copilot_testFailure",
  // not allowed without invocationToken
  "copilot_runInTerminal",
  "copilot_getTerminalOutput",
  "copilot_getTerminalSelection",
  "copilot_getTerminalLastCommand",
  "copilot_editFile",
];

// Function to register all allowed external tools to the MCP Bridge
export function registerExternalTools(mcpBridgeC2V: ToolRegistry) {
  if (!vscode.lm || !vscode.lm.tools) {
    console.error("vscode.lm.tools is not available");
    return;
  }

  // Register only the tools included in the whitelist
  for (const tool of vscode.lm.tools) {
    if (!notAllowedTools.includes(tool.name)) {
      if (!tool.inputSchema || !("type" in tool.inputSchema) || tool.inputSchema.type !== "object") {
        console.error(`Tool ${tool.name} has no input schema or invalid type`);
        continue;
      }
      registerTool(mcpBridgeC2V, tool);
    }
  }
}

// Function to register each tool
function registerTool(mcpBridgeC2V: ToolRegistry, tool: vscode.LanguageModelToolInformation) {
  mcpBridgeC2V.toolWithRawInputSchema(tool.name, tool.description || `Tool: ${tool.name}`, (tool.inputSchema as Tool["inputSchema"] | undefined) ?? { type: "object" }, async (params: any) => {
    try {
      // console.log('TEST', await vscode.lm.invokeTool('copilot_getErrors', {
      //   input: {},
      //   toolInvocationToken: undefined,
      // }));
      // Call the native VSCode tool
      const result = await vscode.lm.invokeTool(tool.name, {
        input: params,
        toolInvocationToken: undefined,
      });

      // Convert the result to the appropriate format
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.content),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error(`Error invoking tool ${tool.name}:`, error);
      return {
        content: [{ type: "text" as const, text: `Error invoking ${tool.name}: ${error}` }],
        isError: true,
      };
    }
  });
}
