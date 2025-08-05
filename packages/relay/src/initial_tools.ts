import { codeCheckerTool } from "./tools/code_checker.js";
import { executeCommandTool } from "./tools/execute_command.js";
import { focusEditorTool } from "./tools/focus_editor.js";
import { getTerminalOutputTool } from "./tools/get_terminal_output.js";
import { listDebugSessionsTool } from "./tools/list_debug_sessions.js";
import { listDirectoryTool } from "./tools/list_directory.js";
import { restartDebugSessionTool } from "./tools/restart_debug_session.js";
import { startDebugSessionTool } from "./tools/start_debug_session.js";
import { stopDebugSessionTool } from "./tools/stop_debug_session.js";
import { textEditorTool } from "./tools/text_editor.js";

export const initialTools = [executeCommandTool, codeCheckerTool, focusEditorTool, listDebugSessionsTool, startDebugSessionTool, restartDebugSessionTool, stopDebugSessionTool, textEditorTool, listDirectoryTool, getTerminalOutputTool];
