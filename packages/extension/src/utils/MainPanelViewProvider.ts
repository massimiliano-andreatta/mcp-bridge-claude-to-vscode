import * as vscode from "vscode";

export class MainPanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mcpBridgeC2V.mainPanelView";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "openAutoApprovalSettings":
            vscode.commands.executeCommand("mcpBridgeC2V.autoApprovalView.focus");
            return;
        }
      },
      undefined,
      []
    );
  }

  public updateServerStatus(status: string) {
    this._view?.webview.postMessage({ command: "updateServerStatus", status: status });
  }

  private _getHtmlForWebview(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Bridge Control Panel</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 1rem;
        }
        .section {
            margin-bottom: 1.5rem;
        }
        h2 {
            font-size: 1.2rem;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: 1px solid var(--vscode-button-border);
            padding: 0.5rem 1rem;
            cursor: pointer;
            border-radius: 2px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="section">
        <h2>Stato del Server</h2>
        <p>Stato: <span id="server-status">Sconosciuto</span></p>
    </div>

    <div class="section">
        <h2>Impostazioni</h2>
        <button id="open-settings-button">Apri Impostazioni di Auto-approvazione</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const openSettingsButton = document.getElementById('open-settings-button');
        
        openSettingsButton.addEventListener('click', () => {
            vscode.postMessage({ command: 'openAutoApprovalSettings' });
        });

        window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent
            switch (message.command) {
                case 'updateServerStatus':
                    const serverStatusElement = document.getElementById('server-status');
                    if (serverStatusElement) {
                        serverStatusElement.textContent = message.status;
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
  }
}
