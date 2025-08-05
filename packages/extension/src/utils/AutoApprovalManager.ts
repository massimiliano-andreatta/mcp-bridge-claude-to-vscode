import * as vscode from "vscode";
import * as path from "path";

export enum OperationType {
  READ = "read",
  WRITE = "write",
  EXECUTE = "execute",
  DEBUG = "debug",
  TERMINAL = "terminal",
  BROWSER = "browser",
}

export interface AutoApprovalPermissions {
  read: {
    enabled: boolean;
    includeOutsideWorkspace: boolean;
  };
  write: {
    enabled: boolean;
    includeOutsideWorkspace: boolean;
    includeProtectedFiles: boolean;
  };
  execute: {
    enabled: boolean;
    allowedCommands: string[];
  };
  debug: {
    enabled: boolean;
  };
  terminal: {
    enabled: boolean;
  };
  browser: {
    enabled: boolean;
  };
}

export interface AutoApprovalLimits {
  maxRequests: number;
  timeWindowMinutes: number;
  retryDelaySeconds: number;
  requestTimeoutSeconds: number;
}

export interface AutoApprovalConfig {
  enabled: boolean;
  permissions: AutoApprovalPermissions;
  limits: AutoApprovalLimits;
}

export interface OperationContext {
  operation: OperationType;
  filePath?: string;
  command?: string;
  description: string;
  isDestructive?: boolean;
}

export class AutoApprovalManager {
  private static instance: AutoApprovalManager;
  private requestCount: Map<string, { count: number; timestamp: number }> =
    new Map();
  private readonly protectedFilePatterns = [
    ".git/**",
    ".vscode/**",
    "node_modules/**",
    "**/.env",
    "**/.env.*",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    "**/*.key",
    "**/*.pem",
    "**/*.p12",
  ];

  private constructor() {}

  static getInstance(): AutoApprovalManager {
    if (!AutoApprovalManager.instance) {
      AutoApprovalManager.instance = new AutoApprovalManager();
    }
    return AutoApprovalManager.instance;
  }

  private getConfig(): AutoApprovalConfig {
    const config = vscode.workspace.getConfiguration("mcpBridgeC2V");
    return config.get<AutoApprovalConfig>("autoApproval", {
      enabled: false,
      permissions: {
        read: { enabled: false, includeOutsideWorkspace: false },
        write: {
          enabled: false,
          includeOutsideWorkspace: false,
          includeProtectedFiles: false,
        },
        execute: { enabled: false, allowedCommands: [] },
        debug: { enabled: false },
        terminal: { enabled: false },
        browser: { enabled: false },
      },
      limits: {
        maxRequests: 100,
        timeWindowMinutes: 60,
        retryDelaySeconds: 10,
        requestTimeoutSeconds: 60,
      },
    });
  }

  private isWithinWorkspace(filePath: string): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return false;
    }

    const normalizedPath = path.resolve(filePath);
    return workspaceFolders.some((folder) => {
      const folderPath = path.resolve(folder.uri.fsPath);
      return normalizedPath.startsWith(folderPath);
    });
  }

  private isProtectedFile(filePath: string): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return true;
    }

    return this.protectedFilePatterns.some((pattern) => {
      // Simple pattern matching - could be enhanced with a proper glob library
      const regexPattern = pattern
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, ".");

      const regex = new RegExp(regexPattern);
      return regex.test(filePath);
    });
  }

  private checkRateLimit(operation: OperationType): boolean {
    const config = this.getConfig();
    const now = Date.now();
    const windowMs = config.limits.timeWindowMinutes * 60 * 1000;

    const key = operation;
    const record = this.requestCount.get(key);

    if (!record || now - record.timestamp > windowMs) {
      this.requestCount.set(key, { count: 1, timestamp: now });
      return true;
    }

    if (record.count >= config.limits.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  private isCommandAllowed(command: string): boolean {
    const config = this.getConfig();
    const allowedCommands = config.permissions.execute.allowedCommands;

    if (allowedCommands.length === 0) {
      return false;
    }

    return allowedCommands.some((allowed) => {
      // Support for wildcards and exact matches
      if (allowed.includes("*")) {
        const regexPattern = allowed.replace(/\*/g, ".*");
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(command);
      }
      return command === allowed || command.startsWith(allowed + " ");
    });
  }

  /**
   * Check if an operation should be auto-approved
   */
  canAutoApprove(context: OperationContext): boolean {
    const config = this.getConfig();

    if (!config.enabled) {
      return false;
    }

    // Check rate limits
    if (!this.checkRateLimit(context.operation)) {
      console.log(`Rate limit exceeded for operation: ${context.operation}`);
      return false;
    }

    const permissions = config.permissions;

    switch (context.operation) {
      case OperationType.READ:
        if (!permissions.read.enabled) return false;
        if (context.filePath && !this.isWithinWorkspace(context.filePath)) {
          return permissions.read.includeOutsideWorkspace;
        }
        return true;

      case OperationType.WRITE:
        if (!permissions.write.enabled) return false;
        if (context.filePath) {
          if (!this.isWithinWorkspace(context.filePath)) {
            if (!permissions.write.includeOutsideWorkspace) return false;
          }
          if (this.isProtectedFile(context.filePath)) {
            if (!permissions.write.includeProtectedFiles) return false;
          }
        }
        return true;

      case OperationType.EXECUTE:
        if (!permissions.execute.enabled) return false;
        if (context.command) {
          return this.isCommandAllowed(context.command);
        }
        return false;

      case OperationType.DEBUG:
        return permissions.debug.enabled;

      case OperationType.TERMINAL:
        return permissions.terminal.enabled;

      case OperationType.BROWSER:
        return permissions.browser.enabled;

      default:
        return false;
    }
  }

  /**
   * Get a user-friendly description of current auto-approval settings
   */
  getStatusDescription(): string {
    const config = this.getConfig();

    if (!config.enabled) {
      return "Auto-approval is disabled";
    }

    const enabledOperations = [];
    if (config.permissions.read.enabled) enabledOperations.push("Read");
    if (config.permissions.write.enabled) enabledOperations.push("Write");
    if (config.permissions.execute.enabled) enabledOperations.push("Execute");
    if (config.permissions.debug.enabled) enabledOperations.push("Debug");
    if (config.permissions.terminal.enabled) enabledOperations.push("Terminal");
    if (config.permissions.browser.enabled) enabledOperations.push("Browser");

    if (enabledOperations.length === 0) {
      return "Auto-approval enabled but no operations allowed";
    }

    return `Auto-approval enabled for: ${enabledOperations.join(", ")}`;
  }

  /**
   * Reset rate limiting counters
   */
  resetRateLimits(): void {
    this.requestCount.clear();
  }

  /**
   * Open configuration settings
   */
  openSettings(): void {
    vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "mcpBridgeC2V.autoApproval"
    );
  }
}
