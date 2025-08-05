import * as vscode from "vscode";
import { BidiHttpTransport } from "../bidi-http-transport";
import { MainPanelViewProvider } from "./MainPanelViewProvider";

/**
 * Gestisce il ciclo di vita del server MCP per prevenire processi appesi
 */
export class ServerLifecycleManager {
  private static instance: ServerLifecycleManager;
  private transport?: BidiHttpTransport;
  private shutdownTimeout?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private lastClientActivity: number = Date.now();
  private readonly CLIENT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minuti
  private readonly HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 secondi
  private readonly SHUTDOWN_TIMEOUT_MS = 10 * 1000; // 10 secondi per shutdown

  private constructor(private outputChannel: vscode.OutputChannel, private mainPanelViewProvider?: MainPanelViewProvider) {}

  static getInstance(outputChannel?: vscode.OutputChannel, mainPanelViewProvider?: MainPanelViewProvider): ServerLifecycleManager {
    if (!ServerLifecycleManager.instance && outputChannel && mainPanelViewProvider) {
      ServerLifecycleManager.instance = new ServerLifecycleManager(outputChannel, mainPanelViewProvider);
    }
    return ServerLifecycleManager.instance;
  }

  /**
   * Registra il transport e inizia il monitoraggio
   */
  registerTransport(transport: BidiHttpTransport): void {
    this.transport = transport;
    this.startHeartbeat();
    this.setupShutdownHandlers();
    this.outputChannel.appendLine("[LifecycleManager] Transport registered and monitoring started");
    this.mainPanelViewProvider?.updateServerStatus("In esecuzione");
  }

  /**
   * Aggiorna il timestamp dell'ultima attività client
   */
  updateClientActivity(): void {
    this.lastClientActivity = Date.now();
  }

  /**
   * Avvia il monitoraggio heartbeat per detectare client disconnessi
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - this.lastClientActivity;

      if (timeSinceLastActivity > this.CLIENT_TIMEOUT_MS) {
        this.outputChannel.appendLine(`[LifecycleManager] No client activity for ${Math.round(timeSinceLastActivity / 1000)}s, initiating shutdown`);
        this.gracefulShutdown("client_timeout");
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Configura gli handler per shutdown graceful
   */
  private setupShutdownHandlers(): void {
    // Handler per chiusura VSCode/estensione (non serve salvare il disposable per questo caso)
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("mcpBridgeC2V")) {
        this.updateClientActivity();
      }
    });

    // Handler per processi Node.js
    process.on("SIGINT", () => this.gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => this.gracefulShutdown("SIGTERM"));
    process.on("exit", () => this.forceShutdown());
    process.on("uncaughtException", (error) => {
      this.outputChannel.appendLine(`[LifecycleManager] Uncaught exception: ${error.message}`);
      this.gracefulShutdown("uncaught_exception");
    });
    process.on("unhandledRejection", (reason) => {
      this.outputChannel.appendLine(`[LifecycleManager] Unhandled rejection: ${reason}`);
      this.gracefulShutdown("unhandled_rejection");
    });
  }

  /**
   * Shutdown graceful con timeout
   */
  private async gracefulShutdown(reason: string): Promise<void> {
    if (this.shutdownTimeout) {
      this.outputChannel.appendLine("[LifecycleManager] Shutdown already in progress");
      return;
    }

    this.outputChannel.appendLine(`[LifecycleManager] Starting graceful shutdown (reason: ${reason})`);

    // Timeout di sicurezza per forzare la chiusura
    this.shutdownTimeout = setTimeout(() => {
      this.outputChannel.appendLine("[LifecycleManager] Graceful shutdown timeout, forcing exit");
      this.forceShutdown();
    }, this.SHUTDOWN_TIMEOUT_MS);

    try {
      // Ferma il heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = undefined;
      }

      // Chiudi il transport se disponibile
      if (this.transport) {
        this.outputChannel.appendLine("[LifecycleManager] Closing transport...");
        await this.transport.close();
        this.transport = undefined;
      }

      // Pulisci il timeout
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
        this.shutdownTimeout = undefined;
      }

      this.outputChannel.appendLine("[LifecycleManager] Graceful shutdown completed");
      this.mainPanelViewProvider?.updateServerStatus("Spento");
    } catch (error) {
      this.outputChannel.appendLine(`[LifecycleManager] Error during graceful shutdown: ${error}`);
      this.mainPanelViewProvider?.updateServerStatus("Errore");
      this.forceShutdown();
    }
  }

  /**
   * Shutdown forzato immediato
   */
  private forceShutdown(): void {
    this.outputChannel.appendLine("[LifecycleManager] Force shutdown initiated");

    try {
      // Cleanup immediato
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
      }

      // Forza chiusura transport
      if (this.transport) {
        (this.transport as any).server?.close?.();
      }
    } catch (error) {
      // Ignora errori durante force shutdown
    }

    // Exit forzato dopo breve delay per logging
    setTimeout(() => {
      process.exit(0);
    }, 100);
  }

  /**
   * Shutdown manuale
   */
  async shutdown(): Promise<void> {
    await this.gracefulShutdown("manual");
  }

  /**
   * Stato del lifecycle manager
   */
  getStatus(): {
    isActive: boolean;
    lastActivity: number;
    timeSinceActivity: number;
  } {
    return {
      isActive: !!this.transport && !!this.heartbeatInterval,
      lastActivity: this.lastClientActivity,
      timeSinceActivity: Date.now() - this.lastClientActivity,
    };
  }
}
