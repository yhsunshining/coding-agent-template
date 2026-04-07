/**
 * Sandbox Module
 *
 * Exports all sandbox-related utilities:
 * - SCF sandbox manager for creating/managing cloud function sandboxes
 * - Tool override for redirecting CLI tools to sandbox
 * - Sandbox MCP proxy for CloudBase tools
 * - Git archive for persisting workspace changes
 */

export {
  scfSandboxManager,
  ScfSandboxManager,
  SandboxInstance,
  type SandboxMode,
  type SandboxProgressCallback,
} from './scf-sandbox-manager.js'

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
