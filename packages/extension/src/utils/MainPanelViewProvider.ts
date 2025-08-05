import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { AutoApprovalManager } from "./AutoApprovalManager";

export class MainPanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mcpBridgeC2V.mainPanelView";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "media")],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "openAutoApprovalSettings":
            vscode.commands.executeCommand("mcpBridgeC2V.autoApprovalView.focus");
            return;
          case "getAutoApprovalConfig":
            this.sendAutoApprovalConfig();
            return;
          case "updateAutoApprovalConfig":
            const config = vscode.workspace.getConfiguration("mcpBridgeC2V");
            await config.update("autoApproval", message.config, vscode.ConfigurationTarget.Global);
            // After updating, re-send the config from the source of truth to confirm
            this.sendAutoApprovalConfig();
            return;
        }
      },
      undefined,
      []
    );

    this.sendAutoApprovalConfig();
  }

  public updateServerStatus(status: string) {
    this._view?.webview.postMessage({ command: "updateServerStatus", status: status });
  }

  public sendAutoApprovalConfig() {
    const autoApprovalManager = AutoApprovalManager.getInstance();
    const config = (autoApprovalManager as any).getConfig(); // getConfig is private
    this._view?.webview.postMessage({ command: "updateAutoApprovalConfig", config: config });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const htmlPath = path.join(this._extensionUri.fsPath, "media", "main-panel.html");
    let htmlContent = fs.readFileSync(htmlPath, "utf8");

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main-panel.css"));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "media", "main-panel.js"));

    htmlContent = htmlContent.replace('href="main-panel.css"', `href="${cssUri}"`);
    htmlContent = htmlContent.replace('src="main-panel.js"', `src="${jsUri}"`);

    return htmlContent;
  }
}
