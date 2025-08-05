import * as vscode from "vscode";

export class StatusBarManager {
  private applyButton: vscode.StatusBarItem;
  private discardButton: vscode.StatusBarItem;
  private resolvePromise: ((value: boolean) => void) | null = null;

  constructor() {
    // Create Apply button in the status bar (checkmark icon)
    this.applyButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, Infinity);
    this.applyButton.text = "$(check)";
    this.applyButton.command = "mcp.textEditor.applyChanges";
    this.applyButton.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    this.applyButton.tooltip = "Apply the pending changes";

    // Create Discard button in the status bar (x icon)
    this.discardButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, Infinity);
    this.discardButton.text = "$(x)";
    this.discardButton.command = "mcp.textEditor.cancelChanges";
    this.discardButton.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    this.discardButton.tooltip = "Discard the pending changes";

    // Register commands
    this.registerCommands();
  }

  private registerCommands(): void {
    console.log("[StatusBarManager] Registering commands");

    // Register MCP text editor commands
    vscode.commands.registerCommand("mcp.textEditor.applyChanges", () => {
      console.log("[StatusBarManager] MCP apply command triggered");
      this.hide();
      this.resolvePromise?.(true);
      this.resolvePromise = null;
      return true;
    });

    vscode.commands.registerCommand("mcp.textEditor.cancelChanges", () => {
      console.log("[StatusBarManager] MCP cancel command triggered");
      this.hide();
      this.resolvePromise?.(false);
      this.resolvePromise = null;
      return false;
    });
  }

  /**
   * Displays buttons on the status bar and waits for user selection.
   * @param applyLabel The label for the apply button (default is "Apply Change").
   * @param discardLabel The label for the discard button (default is "Discard Change").
   * @returns A promise that resolves to true if the user selects the apply button, and false if they select the discard button.
   */
  async ask(applyLabel: string, discardLabel: string): Promise<boolean> {
    console.log("[StatusBarManager] ask method called");

    this.applyButton.text = `$(check) ${applyLabel}`;
    this.discardButton.text = `$(x) ${discardLabel}`;

    return new Promise<boolean>((resolve) => {
      console.log("[StatusBarManager] Setting resolvePromise and showing buttons");
      this.resolvePromise = resolve;
      this.show();
    });
  }

  /**
   * Shows the buttons on the status bar.
   */
  private show(): void {
    this.applyButton.show();
    this.discardButton.show();
  }

  /**
   * Hides the buttons from the status bar.
   */
  hide(): void {
    this.applyButton.hide();
    this.discardButton.hide();
  }

  /**
   * Disposes of the resources.
   */
  dispose(): void {
    this.hide();
    this.applyButton.dispose();
    this.discardButton.dispose();
  }
}
