# MCP Bridge - Claude to VSCode

**Expose VSCode features such as file viewing and editing as MCP, enabling the LLM to access these functionalities.**

This VSCode extension transforms your editor into an MCP Bridge, allowing advanced coding assistance from MCP clients like Claude Desktop. It provides a suite of tools for code editing, terminal operations, and debugging, directly accessible to the LLM.

## Key Features

- **Code Editing Support**: Review proposed code changes from an LLM through diffs, allowing you to accept, reject, or provide feedback. Real-time diagnostic messages are sent instantly to the LLM for immediate corrections.
- **Terminal Operations**: Execute commands within VSCode’s integrated terminal, with support for background/foreground execution and timeout settings.
- **Preview Tools**: Preview URLs directly within VSCode’s built-in browser (e.g., automatically opens a browser preview after starting a Vite server).
- **Multi-instance Switching**: Easily switch the MCP Bridge between multiple open VSCode windows.
- **Relay Functionality (Experimental)**: Relay and expose built-in MCP Bridges introduced in VSCode 1.99 externally, allowing external access to tools provided by other MCP extensions like GitHub Copilot.

## Available Built-in Tools

- **execute_command**: Execute commands in VSCode’s integrated terminal
- **code_checker**: Retrieve current diagnostics for your code
- **focus_editor**: Focus specific locations within files
- **list_debug_sessions** / **start_debug_session** / **restart_debug_session** / **stop_debug_session**: Manage debug sessions
- **text_editor**: File operations (view, replace, create, insert, undo)
- **list_directory**: List directory contents in a tree format
- **get_terminal_output**: Fetch output from a specified terminal
- **list_vscode_commands** / **execute_vscode_command**: List and execute arbitrary VSCode commands
- **preview_url**: Open URLs within VSCode’s integrated browser

## Installation & Setup

To get started, configure your MCP client to connect to the server provided by this extension.

- **Using mcp-installer**: Instruct it to "install the vscode-as-mcp-server MCP Bridge".
- **Other clients (e.g., Claude Desktop)**: Add the following to your configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcpBridgeC2Vs": {
      "command": "npx",
      "args": ["mcp-bridge-claude-to-vscode"]
    }
  }
}
```

Check the MCP Bridge status in the bottom-right VSCode status bar:

- ✅: Server is running
- ∅: Click to start the server

## Commands

The following commands are available in the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- `MCP Bridge C2V: Stop Server`: Stops the MCP Bridge.
- `MCP Bridge C2V: Start Server`: Starts the MCP Bridge.
- `MCP Bridge C2V: Toggle Active Status`: Toggles the server's active state.

## Configuration

You can customize the extension's behavior via the VSCode settings (`settings.json`):

- **`mcpBridgeC2V.startOnActivate`**:

  - **Description**: Determines if the MCP Bridge C2V should start automatically on VSCode activation.
  - **Type**: `boolean`
  - **Default**: `true`

- **`mcpBridgeC2V.port`**:

  - **Description**: The port that the MCP Bridge C2V listens on. Set in case of conflicts or custom configurations.
  - **Type**: `number`
  - **Default**: `60100`

- **`mcpBridgeC2V.confirmationUI`**:

  - **Description**: The UI to use for confirming changes.
  - **Type**: `string`
  - **Options**: `statusBar` (status bar buttons) or `quickPick` (quick pick dialog).
  - **Default**: `quickPick`

- **`mcpBridgeC2V.confirmNonDestructiveCommands`**:
  - **Description**: If true, even commands marked as non-destructive (`modifySomething=false`) will require user confirmation.
  - **Type**: `boolean`
  - **Default**: `false`
