/**
 * Sandbox Module
 *
 * AGS sandbox manager — pure HTTP data plane, no e2b SDK.
 * Control plane: @cloudbase/manager-node commonService
 * Data plane: HTTP fetch to TRW via TCB gateway
 */

export {
  agsSandboxManager as sandboxManager,
  agsSandboxManager as scfSandboxManager, // compat alias for existing consumers
  AgsSandboxManager,
  SandboxInstance,
  type SandboxMode,
  type SandboxProgressCallback,
} from './ags-sandbox-manager.js'

export { createSandboxMcpClient, type SandboxMcpDeps } from './sandbox-mcp-proxy.js'

export {
  archiveToGit,
  deleteArchiveDirectory,
  deleteArchiveDirectories,
  deleteArchiveBranch,
  deleteArchiveBranches,
  deleteConversationViaSandbox,
  isGitArchiveConfigured,
  type GitArchiveConfig,
} from './git-archive.js'

export { overrideTools, type ToolOverrideConfig, type ToolResult, type ToolContext } from './tool-override.js'
