import * as vscode from "vscode";
import { BidiHttpTransport } from "./bidi-http-transport";
import { registerVSCodeCommands } from "./commands";
import { createMcpServer, extensionDisplayName } from "./mcp-server";
import { DIFF_VIEW_URI_SCHEME } from "./utils/DiffViewProvider";
import { MainPanelViewProvider } from "./utils/MainPanelViewProvider";
import { AutoApprovalManager } from "./utils/AutoApprovalManager";
import { ServerLifecycleManager } from "./utils/ServerLifecycleManager";

// Status bar item to display the status of the MCP Bridge
let serverStatusBarItem: vscode.StatusBarItem;
let transport: BidiHttpTransport;

// Function to update the status bar
function updateServerStatusBar(status: "running" | "stopped" | "starting" | "tool_list_updated") {
  if (!serverStatusBarItem) {
    return;
  }

  // Get auto-approval status
  const autoApprovalManager = AutoApprovalManager.getInstance();
  const config = vscode.workspace.getConfiguration("mcpBridgeC2V");
  const autoApprovalEnabled = config.get("autoApproval.enabled", false);
  const autoApprovalIcon = autoApprovalEnabled ? "$(shield)" : "$(shield-x)";

  switch (status) {
    case "running":
      serverStatusBarItem.text = `$(server) MCP Bridge ${autoApprovalIcon}`;
      serverStatusBarItem.tooltip = `MCP Bridge is running\n${autoApprovalManager.getStatusDescription()}`;
      serverStatusBarItem.command = "mcpBridgeC2V.stopServer";
      break;
    case "starting":
      serverStatusBarItem.text = `$(sync~spin) MCP Bridge ${autoApprovalIcon}`;
      serverStatusBarItem.tooltip = "Starting...";
      serverStatusBarItem.command = undefined;
      break;
    case "tool_list_updated":
      serverStatusBarItem.text = `$(warning) MCP Bridge ${autoApprovalIcon}`;
      serverStatusBarItem.tooltip = `Tool list updated - Restart MCP Client\n${autoApprovalManager.getStatusDescription()}`;
      serverStatusBarItem.command = "mcpBridgeC2V.stopServer";
      break;
    case "stopped":
    default:
      serverStatusBarItem.text = `$(circle-slash) MCP Bridge ${autoApprovalIcon}`;
      serverStatusBarItem.tooltip = `MCP Bridge is not running\n${autoApprovalManager.getStatusDescription()}`;
      serverStatusBarItem.command = "mcpBridgeC2V.toggleActiveStatus";
      break;
  }
  serverStatusBarItem.show();
}

export const activate = async (context: vscode.ExtensionContext) => {
  // Create the output channel for logging
  const outputChannel = vscode.window.createOutputChannel(extensionDisplayName);
  outputChannel.appendLine(`Activating ${extensionDisplayName}...`);

  const mcpBridgeC2V = createMcpServer(outputChannel);

  // Register Main Panel WebView Provider
  const mainPanelProvider = new MainPanelViewProvider(context.extensionUri);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(MainPanelViewProvider.viewType, mainPanelProvider));

  // Get the singleton instance of ServerLifecycleManager
  const lifecycleManager = ServerLifecycleManager.getInstance(outputChannel, mainPanelProvider);

  // Create status bar item
  serverStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(serverStatusBarItem);

  // Server start function
  async function startServer(port: number) {
    outputChannel.appendLine(`DEBUG: Starting MCP Bridge on port ${port}...`);
    transport = new BidiHttpTransport(port, outputChannel);
    lifecycleManager.registerTransport(transport); // Register transport with lifecycle manager
    // Set the event handler for server status changes
    transport.onServerStatusChanged = (status) => {
      updateServerStatusBar(status);
    };

    await mcpBridgeC2V.connect(transport); // connect calls transport.start().
    updateServerStatusBar(transport.serverStatus);
  }

  // Register Diff View Provider for file comparison functionality
  const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
      return Buffer.from(uri.query, "base64").toString("utf-8");
    }
  })();

  // Change the URI scheme of the DiffViewProvider to mcp-diff
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider));

  // Start server if configured to do so
  const mcpConfig = vscode.workspace.getConfiguration("mcpBridgeC2V");
  const port = mcpConfig.get<number>("port", 60100);
  try {
    await startServer(port);
    outputChannel.appendLine(`MCP Bridge started on port ${port}.`);
  } catch (err) {
    outputChannel.appendLine(`Failed to start MCP Bridge: ${err}`);
  }

  // Register VSCode commands
  registerVSCodeCommands(context, mcpBridgeC2V, outputChannel, startServer, transport);

  outputChannel.appendLine(`${extensionDisplayName} activated.`);
};

export async function deactivate() {
  // Graceful shutdown usando il ServerLifecycleManager
  try {
    const lifecycleManager = ServerLifecycleManager.getInstance();
    await lifecycleManager.shutdown();
  } catch (error) {}

  // Clean-up is managed by the disposables added in the activate method.
}
