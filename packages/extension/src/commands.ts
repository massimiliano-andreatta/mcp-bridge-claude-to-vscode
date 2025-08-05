import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as vscode from "vscode";
import { AutoApprovalManager } from "./utils/AutoApprovalManager";
import { ServerLifecycleManager } from "./utils/ServerLifecycleManager";

export interface ServerState {
  value: boolean;
}

import { BidiHttpTransport } from "./bidi-http-transport";

export function registerVSCodeCommands(
  context: vscode.ExtensionContext,
  mcpBridgeC2V: McpServer,
  outputChannel: vscode.OutputChannel,
  startServer: (port: number) => Promise<void>,
  transport?: BidiHttpTransport
) {
  // テキストエディタのアクションコマンドを登録
  context.subscriptions.push(
    vscode.commands.registerCommand("textEditor.applyChanges", () => {
      vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
      return true;
    }),
    vscode.commands.registerCommand("textEditor.cancelChanges", () => {
      vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
      return false;
    })
  );
  // COMMAND PALETTE COMMAND: Stop the MCP Bridge
  context.subscriptions.push(
    vscode.commands.registerCommand("mcpBridgeC2V.stopServer", () => {
      try {
        mcpBridgeC2V.close();
        outputChannel.appendLine("MCP Bridge stopped.");
      } catch (err) {
        vscode.window.showWarningMessage("MCP Bridge is not running.");
        outputChannel.appendLine(
          "Attempted to stop the MCP Bridge, but it is not running."
        );
        return;
      }
      mcpBridgeC2V.close();
    })
  );

  // COMMAND PALETTE COMMAND: Start the MCP Bridge
  context.subscriptions.push(
    vscode.commands.registerCommand("mcpBridgeC2V.startServer", async () => {
      try {
        const port = vscode.workspace
          .getConfiguration("mcpBridgeC2V")
          .get<number>("port", 60100);
        await startServer(port);
        outputChannel.appendLine(`MCP Bridge started on port ${port}.`);
        vscode.window.showInformationMessage(
          `MCP Bridge started on port ${port}.`
        );
      } catch (err) {
        outputChannel.appendLine(`Failed to start MCP Bridge: ${err}`);
        vscode.window.showErrorMessage(`Failed to start MCP Bridge: ${err}`);
      }
    })
  );

  // Request handover
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcpBridgeC2V.toggleActiveStatus",
      async () => {
        if (!transport) {
          vscode.window.showWarningMessage("MCP Bridge is not running.");
          return;
        }

        try {
          const success = await transport.requestHandover();
          if (success) {
            outputChannel.appendLine("Handover request successful");
          } else {
            vscode.window.showErrorMessage(
              "Failed to complete handover request."
            );
          }
        } catch (err) {
          outputChannel.appendLine(`Error requesting handover: ${err}`);
          vscode.window.showErrorMessage(
            `Failed to complete handover request: ${err}`
          );
        }
      }
    )
  );

  // Auto-Approval Commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcpBridgeC2V.openAutoApprovalSettings",
      () => {
        const autoApprovalManager = AutoApprovalManager.getInstance();
        autoApprovalManager.openSettings();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mcpBridgeC2V.toggleAutoApproval",
      async () => {
        const config = vscode.workspace.getConfiguration("mcpBridgeC2V");
        const currentAutoApproval = config.get("autoApproval", {
          enabled: false,
        });
        const newEnabled = !currentAutoApproval.enabled;

        await config.update(
          "autoApproval",
          {
            ...currentAutoApproval,
            enabled: newEnabled,
          },
          vscode.ConfigurationTarget.Global
        );

        const autoApprovalManager = AutoApprovalManager.getInstance();
        const statusMessage = newEnabled
          ? `Auto-approval enabled. ${autoApprovalManager.getStatusDescription()}`
          : "Auto-approval disabled";

        vscode.window.showInformationMessage(statusMessage);
        outputChannel.appendLine(
          `Auto-approval ${newEnabled ? "enabled" : "disabled"}`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("mcpBridgeC2V.resetRateLimits", () => {
      const autoApprovalManager = AutoApprovalManager.getInstance();
      autoApprovalManager.resetRateLimits();
      vscode.window.showInformationMessage("Rate limits have been reset");
      outputChannel.appendLine("Auto-approval rate limits reset");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("mcpBridgeC2V.showLifecycleStatus", () => {
      const lifecycleManager = ServerLifecycleManager.getInstance();
      const status = lifecycleManager.getStatus();

      const statusMessage = `
MCP Bridge Lifecycle Status:
- Active: ${status.isActive ? "Yes" : "No"}
- Last Client Activity: ${new Date(status.lastActivity).toLocaleString()}
- Time Since Activity: ${Math.round(status.timeSinceActivity / 1000)}s
- Transport Status: ${transport ? transport.serverStatus : "Not initialized"}
      `.trim();

      vscode.window.showInformationMessage(statusMessage, { modal: false });
      outputChannel.appendLine(statusMessage);
    })
  );
}
