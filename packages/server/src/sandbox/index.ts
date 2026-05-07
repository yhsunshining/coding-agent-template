/**
 * Sandbox Module
 *
 * Exports sandbox manager based on deployment mode:
 * - AGS mode (E2B_API_KEY set): uses e2b-tcb SDK via TCB gateway
 * - SCF mode (fallback): uses SCF function creation via CloudBase manager
 */

export {
  agsSandboxManager as scfSandboxManager,
  AgsSandboxManager as ScfSandboxManager,
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
