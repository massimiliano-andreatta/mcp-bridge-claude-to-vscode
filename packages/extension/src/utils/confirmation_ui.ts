import * as vscode from "vscode";
import { StatusBarManager } from "./StatusBarManager";
import { AutoApprovalManager, OperationContext } from "./AutoApprovalManager";

/**
 * Utility class to display a confirmation UI based on settings.
 */
export class ConfirmationUI {
  // Singleton instance of StatusBarManager
  private static statusBarManager: StatusBarManager | null = null;

  /**
   * Gets or initializes the instance of StatusBarManager.
   */
  private static getStatusBarManager(): StatusBarManager {
    if (!this.statusBarManager) {
      this.statusBarManager = new StatusBarManager();
    }
    return this.statusBarManager;
  }

  /**
   * Displays a confirmation UI before executing a command, based on settings.
   * @param message The confirmation message.
   * @param detail Additional details (e.g., the command).
   * @param approveLabel The label for the approve button.
   * @param denyLabel The label for the deny button.
   * @param operationContext Optional: The operation context for auto-approval.
   * @returns "Approve" if the action is approved, or "Deny" or a reason text if it is denied.
   */
  static async confirm(message: string, detail: string, approveLabel: string, denyLabel: string, operationContext?: OperationContext): Promise<string> {
    // Check for auto-approval
    if (operationContext) {
      const autoApprovalManager = AutoApprovalManager.getInstance();
      if (autoApprovalManager.canAutoApprove(operationContext)) {
        console.log(`[ConfirmationUI] Auto-approved operation: ${operationContext.operation} - ${operationContext.description}`);

        // Notify the user of auto-approval (non-intrusive)
        vscode.window.setStatusBarMessage(`$(check) Auto-approved: ${operationContext.description}`, 3000);

        return "Approve";
      }
    }

    // Get the confirmation UI method from settings
    const config = vscode.workspace.getConfiguration("mcpBridgeC2V");
    const confirmationUI = config.get<string>("confirmationUI", "quickPick");

    console.log(`[ConfirmationUI] Using ${confirmationUI} UI for confirmation`);

    if (confirmationUI === "quickPick") {
      return await this.showQuickPickConfirmation(message, detail, approveLabel, denyLabel, operationContext);
    } else {
      return await this.showStatusBarConfirmation(message, detail, approveLabel, denyLabel, operationContext);
    }
  }

  /**
   * Displays a confirmation UI using QuickPick.
   */
  private static async showQuickPickConfirmation(message: string, detail: string, approveLabel: string, denyLabel: string, operationContext?: OperationContext): Promise<string> {
    // Create a QuickPick
    const quickPick = vscode.window.createQuickPick();

    quickPick.title = message;
    quickPick.placeholder = detail || "";

    const items = [
      { label: `$(check) Approve`, description: approveLabel },
      { label: `$(x) Deny`, description: denyLabel },
    ];

    // Add auto-approval settings option
    if (operationContext) {
      const autoApprovalManager = AutoApprovalManager.getInstance();
      items.push({
        label: `$(gear) Auto-Approval Settings`,
        description: `Current: ${autoApprovalManager.getStatusDescription()}`,
      });
    }

    quickPick.items = items;
    quickPick.canSelectMany = false;
    quickPick.ignoreFocusOut = true;

    return new Promise<string>(async (resolve) => {
      quickPick.onDidAccept(async () => {
        const selection = quickPick.selectedItems[0];
        quickPick.hide();

        if (selection.label.includes("Auto-Approval Settings")) {
          // Open settings
          const autoApprovalManager = AutoApprovalManager.getInstance();
          autoApprovalManager.openSettings();
          resolve("Deny"); // Deny the request after opening settings
          return;
        }

        if (selection.label.includes("Approve")) {
          resolve("Approve");
        } else {
          // Show QuickInput for feedback if denied
          const inputBox = vscode.window.createInputBox();
          inputBox.title = "Feedback";
          inputBox.placeholder = "Add context for the agent (optional)";

          inputBox.onDidAccept(() => {
            const feedback = inputBox.value.trim();
            inputBox.hide();
            resolve(feedback || "Deny");
          });

          inputBox.onDidHide(() => {
            if (inputBox.value.trim() === "") {
              resolve("Deny");
            }
          });

          inputBox.show();
        }
      });

      quickPick.onDidHide(() => {
        // Handle dismissal of the QuickPick
        if (!quickPick.selectedItems || quickPick.selectedItems.length === 0) {
          resolve("Deny");
        }
      });

      quickPick.show();
    });
  }

  /**
   * Displays a confirmation UI using the status bar.
   */
  private static async showStatusBarConfirmation(message: string, detail: string, approveLabel: string, denyLabel: string, operationContext?: OperationContext): Promise<string> {
    // Show the message
    vscode.window.showInformationMessage(`${message} ${detail ? `- ${detail}` : ""}`);

    // Get the StatusBarManager instance
    try {
      const statusBarManager = this.getStatusBarManager();

      // Wait for user selection using StatusBarManager
      console.log("[ConfirmationUI] Using StatusBarManager for confirmation");
      const approved = await statusBarManager.ask(approveLabel, denyLabel);
      statusBarManager.hide();

      // If approved, return "Approve"
      if (approved) {
        return "Approve";
      }

      // If denied, collect additional feedback
      const inputBox = vscode.window.createInputBox();
      inputBox.title = "Feedback";
      inputBox.placeholder = "Add context for the agent (optional)";

      return new Promise<string>((resolve) => {
        inputBox.onDidAccept(() => {
          const feedback = inputBox.value.trim();
          inputBox.hide();
          resolve(feedback || "Deny");
        });

        inputBox.onDidHide(() => {
          if (inputBox.value.trim() === "") {
            resolve("Deny");
          }
        });

        inputBox.show();
      });
    } catch (error) {
      console.error("Error using StatusBarManager:", error);
      // If an error occurs, fall back to QuickPick
      console.log("[ConfirmationUI] Falling back to QuickPick confirmation");
      return await this.showQuickPickConfirmation(message, detail, approveLabel, denyLabel, operationContext);
    }
  }
}
