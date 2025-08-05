import * as vscode from "vscode";
import { AutoApprovalManager } from "./AutoApprovalManager";

export class AutoApprovalWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mcpBridgeC2V.autoApprovalView";

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "updateConfig":
            this._updateConfiguration(message.config);
            break;
          case "resetRateLimits":
            this._resetRateLimits();
            break;
          case "getConfig":
            this._sendCurrentConfig();
            break;
        }
      },
      undefined,
      []
    );

    // Send initial config
    this._sendCurrentConfig();
  }

  private async _updateConfiguration(config: any) {
    try {
      const vsCodeConfig = vscode.workspace.getConfiguration("mcpBridgeC2V");
      await vsCodeConfig.update(
        "autoApproval",
        config,
        vscode.ConfigurationTarget.Global
      );

      vscode.window.showInformationMessage(
        "Auto-approval settings updated successfully"
      );

      // Send updated config back to webview
      this._sendCurrentConfig();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update settings: ${error}`);
    }
  }

  private _resetRateLimits() {
    const autoApprovalManager = AutoApprovalManager.getInstance();
    autoApprovalManager.resetRateLimits();
    vscode.window.showInformationMessage("Rate limits have been reset");
  }

  private _sendCurrentConfig() {
    if (!this._view) {
      return;
    }

    const config = vscode.workspace.getConfiguration("mcpBridgeC2V");
    const autoApprovalConfig = config.get("autoApproval");

    this._view.webview.postMessage({
      type: "configUpdate",
      config: autoApprovalConfig,
    });
  }

  private _getHtmlForWebview(_webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auto-Approval Settings</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 16px;
            margin: 0;
        }
        
        .section {
            margin-bottom: 24px;
            padding: 16px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background-color: var(--vscode-editor-background);
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 12px;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .option {
            margin-bottom: 16px;
        }
        
        .option-label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
        }
        
        .option-description {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        
        .checkbox-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .checkbox-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        input[type="checkbox"] {
            accent-color: var(--vscode-focusBorder);
        }
        
        input[type="number"], input[type="text"] {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            padding: 4px 8px;
            border-radius: 2px;
            width: 100px;
        }
        
        .command-list {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            padding: 8px;
            border-radius: 2px;
            min-height: 60px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            resize: vertical;
        }
        
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 2px;
            cursor: pointer;
            margin-right: 8px;
            margin-bottom: 8px;
        }
        
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .status {
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 16px;
            font-size: 14px;
        }
        
        .status.enabled {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }
        
        .status.disabled {
            background-color: var(--vscode-testing-iconFailed);
            color: var(--vscode-editor-background);
        }
        
        .icon {
            width: 16px;
            height: 16px;
        }
        
        .limits-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        
        @media (max-width: 600px) {
            .limits-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div id="app">
        <div class="status" id="statusIndicator">
            <span id="statusText">Loading...</span>
        </div>
        
        <div class="section">
            <div class="section-title">
                <span class="icon">⚙️</span>
                Auto-Approval Master Switch
            </div>
            <div class="option">
                <label class="checkbox-item">
                    <input type="checkbox" id="masterSwitch">
                    <span>Enable Auto-Approval System</span>
                </label>
                <div class="option-description">
                    When enabled, allows automatic approval of operations based on the permissions set below.
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">
                <span class="icon">📖</span>
                Read Operations
            </div>
            <div class="checkbox-group">
                <label class="checkbox-item">
                    <input type="checkbox" id="readEnabled">
                    <span>Auto-approve read operations</span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="readOutsideWorkspace">
                    <span>Allow reading files outside workspace</span>
                </label>
            </div>
            <div class="option-description">
                Automatically approve file viewing and directory listing operations.
            </div>
        </div>

        <div class="section">
            <div class="section-title">
                <span class="icon">✏️</span>
                Write Operations
            </div>
            <div class="checkbox-group">
                <label class="checkbox-item">
                    <input type="checkbox" id="writeEnabled">
                    <span>Auto-approve write operations</span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="writeOutsideWorkspace">
                    <span>Allow writing files outside workspace</span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="writeProtectedFiles">
                    <span>Allow modifying protected files</span>
                </label>
            </div>
            <div class="option-description">
                Automatically approve file creation, modification, and deletion operations. Protected files include .git, .env, package-lock.json, etc.
            </div>
        </div>

        <div class="section">
            <div class="section-title">
                <span class="icon">⚡</span>
                Execute Operations
            </div>
            <div class="checkbox-group">
                <label class="checkbox-item">
                    <input type="checkbox" id="executeEnabled">
                    <span>Auto-approve command execution</span>
                </label>
            </div>
            <div class="option">
                <label class="option-label">Allowed Commands (one per line, supports wildcards like npm*)</label>
                <textarea id="allowedCommands" class="command-list" placeholder="npm install&#10;git status&#10;ls *&#10;pwd"></textarea>
            </div>
            <div class="option-description">
                Automatically approve execution of specified commands. Leave empty to disable all command execution.
            </div>
        </div>

        <div class="section">
            <div class="section-title">
                <span class="icon">🔧</span>
                Other Operations
            </div>
            <div class="checkbox-group">
                <label class="checkbox-item">
                    <input type="checkbox" id="debugEnabled">
                    <span>Auto-approve debug operations</span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="terminalEnabled">
                    <span>Auto-approve terminal operations</span>
                </label>
                <label class="checkbox-item">
                    <input type="checkbox" id="browserEnabled">
                    <span>Auto-approve browser preview operations</span>
                </label>
            </div>
        </div>

        <div class="section">
            <div class="section-title">
                <span class="icon">🛡️</span>
                Rate Limits
            </div>
            <div class="limits-grid">
                <div class="option">
                    <label class="option-label">Max Requests</label>
                    <input type="number" id="maxRequests" min="1" max="1000">
                    <div class="option-description">Maximum requests per time window</div>
                </div>
                <div class="option">
                    <label class="option-label">Time Window (minutes)</label>
                    <input type="number" id="timeWindow" min="1" max="1440">
                    <div class="option-description">Time window for rate limiting</div>
                </div>
                <div class="option">
                    <label class="option-label">Retry Delay (seconds)</label>
                    <input type="number" id="retryDelay" min="1" max="300">
                    <div class="option-description">Delay before retrying requests</div>
                </div>
                <div class="option">
                    <label class="option-label">Request Timeout (seconds)</label>
                    <input type="number" id="requestTimeout" min="1" max="600">
                    <div class="option-description">Timeout for automatic approval</div>
                </div>
            </div>
        </div>

        <div class="section">
            <button class="button" onclick="saveSettings()">Save Settings</button>
            <button class="button secondary" onclick="resetRateLimits()">Reset Rate Limits</button>
            <button class="button secondary" onclick="loadSettings()">Reload Settings</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentConfig = {};

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'configUpdate':
                    currentConfig = message.config || getDefaultConfig();
                    updateUI();
                    break;
            }
        });

        function getDefaultConfig() {
            return {
                enabled: false,
                permissions: {
                    read: { enabled: false, includeOutsideWorkspace: false },
                    write: { enabled: false, includeOutsideWorkspace: false, includeProtectedFiles: false },
                    execute: { enabled: false, allowedCommands: [] },
                    debug: { enabled: false },
                    terminal: { enabled: false },
                    browser: { enabled: false }
                },
                limits: {
                    maxRequests: 100,
                    timeWindowMinutes: 60,
                    retryDelaySeconds: 10,
                    requestTimeoutSeconds: 60
                }
            };
        }

        function updateUI() {
            const config = currentConfig;
            
            // Update status indicator
            const statusIndicator = document.getElementById('statusIndicator');
            const statusText = document.getElementById('statusText');
            
            if (config.enabled) {
                statusIndicator.className = 'status enabled';
                statusText.textContent = '✅ Auto-Approval is ENABLED';
            } else {
                statusIndicator.className = 'status disabled';
                statusText.textContent = '❌ Auto-Approval is DISABLED';
            }
            
            // Update form fields
            document.getElementById('masterSwitch').checked = config.enabled;
            document.getElementById('readEnabled').checked = config.permissions.read.enabled;
            document.getElementById('readOutsideWorkspace').checked = config.permissions.read.includeOutsideWorkspace;
            document.getElementById('writeEnabled').checked = config.permissions.write.enabled;
            document.getElementById('writeOutsideWorkspace').checked = config.permissions.write.includeOutsideWorkspace;
            document.getElementById('writeProtectedFiles').checked = config.permissions.write.includeProtectedFiles;
            document.getElementById('executeEnabled').checked = config.permissions.execute.enabled;
            document.getElementById('allowedCommands').value = config.permissions.execute.allowedCommands.join('\\n');
            document.getElementById('debugEnabled').checked = config.permissions.debug.enabled;
            document.getElementById('terminalEnabled').checked = config.permissions.terminal.enabled;
            document.getElementById('browserEnabled').checked = config.permissions.browser.enabled;
            
            document.getElementById('maxRequests').value = config.limits.maxRequests;
            document.getElementById('timeWindow').value = config.limits.timeWindowMinutes;
            document.getElementById('retryDelay').value = config.limits.retryDelaySeconds;
            document.getElementById('requestTimeout').value = config.limits.requestTimeoutSeconds;
        }

        function collectFormData() {
            const allowedCommandsText = document.getElementById('allowedCommands').value;
            const allowedCommands = allowedCommandsText
                .split('\\n')
                .map(cmd => cmd.trim())
                .filter(cmd => cmd.length > 0);

            return {
                enabled: document.getElementById('masterSwitch').checked,
                permissions: {
                    read: {
                        enabled: document.getElementById('readEnabled').checked,
                        includeOutsideWorkspace: document.getElementById('readOutsideWorkspace').checked
                    },
                    write: {
                        enabled: document.getElementById('writeEnabled').checked,
                        includeOutsideWorkspace: document.getElementById('writeOutsideWorkspace').checked,
                        includeProtectedFiles: document.getElementById('writeProtectedFiles').checked
                    },
                    execute: {
                        enabled: document.getElementById('executeEnabled').checked,
                        allowedCommands: allowedCommands
                    },
                    debug: {
                        enabled: document.getElementById('debugEnabled').checked
                    },
                    terminal: {
                        enabled: document.getElementById('terminalEnabled').checked
                    },
                    browser: {
                        enabled: document.getElementById('browserEnabled').checked
                    }
                },
                limits: {
                    maxRequests: parseInt(document.getElementById('maxRequests').value) || 100,
                    timeWindowMinutes: parseInt(document.getElementById('timeWindow').value) || 60,
                    retryDelaySeconds: parseInt(document.getElementById('retryDelay').value) || 10,
                    requestTimeoutSeconds: parseInt(document.getElementById('requestTimeout').value) || 60
                }
            };
        }

        function saveSettings() {
            const config = collectFormData();
            vscode.postMessage({
                type: 'updateConfig',
                config: config
            });
        }

        function resetRateLimits() {
            vscode.postMessage({
                type: 'resetRateLimits'
            });
        }

        function loadSettings() {
            vscode.postMessage({
                type: 'getConfig'
            });
        }

        // Initialize
        loadSettings();
    </script>
</body>
</html>`;
  }
}
