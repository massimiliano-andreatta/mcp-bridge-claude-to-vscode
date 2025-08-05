# MCP Bridge C2V - Claude Desktop to VSCode

## 1. Overview

This project, **MCP Bridge C2V - Claude Desktop to VSCode**, transforms Visual Studio Code into a feature-rich service, exposing its core functionalities through a secure and modular API. It follows a client-server architecture, allowing external clients to programmatically interact with the IDE for tasks like code editing, command execution, and debugging. The system is designed as a monorepo, containing two primary packages: `extension` and `relay`.

## 2. Architecture

The high-level architecture is composed of two main components working in tandem:

- **`extension` Package**: This is the server-side core of the project, implemented as a VS Code extension. It listens for incoming requests and exposes the IDE's features through various transport protocols, including Server-Sent Events (SSE), bidirectional HTTP, and WebSockets. The main entry point is `extension.ts`, while the server logic resides in `mcp-server.ts`.

- **`relay` Package**: A lightweight proxy that acts as an intermediary between an external client and the `extension` server. Its primary role is to forward requests, simplifying client connections and providing an additional layer for security, logging, or caching.

## 3. Core Functionality

The system's functionality is exposed through a set of "tools," which are granular modules for specific IDE interactions. A `ToolRegistry` manages these tools, using Zod for input validation.

Key tools include:

- **`code_checker.ts`**: Fetches workspace diagnostics, such as errors and warnings.
- **`debug_tools.ts`**: Provides controls for the VS Code debugger (e.g., starting sessions, setting breakpoints).
- **`execute_command.ts`**: Securely executes shell commands within the VS Code environment.
- **`text_editor.ts`**: Manages file operations, including reading, creating, inserting, and replacing content. Changes are presented to the user via a "diff" view for approval.
- **`list_directory.ts`**: Lists the contents of a directory, respecting rules from `.gitignore`.
- **`register_external_tools.ts`**: Allows for the dynamic registration of new tools from other VS Code extensions, making the system extensible.

## 4. Communication Flow

The request-response cycle is designed for resilience and clarity:

1.  An external client sends a request to the **`relay`** proxy (`packages/relay/src/index.ts`).
2.  The `relay` communicates with the client via `stdio` and forwards the request to the **`extension`** server using HTTP JSON-RPC. It includes features like caching for the tool list and a retry mechanism for network stability.
3.  The **`extension`** server (`mcp-server.ts`) receives the request.
4.  The `ToolRegistry` validates the request payload against the corresponding tool's schema and invokes the tool's callback function.
5.  The tool executes the requested action within VS Code.
6.  The result is sent back to the client through the same `relay` proxy.
