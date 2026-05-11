/**
 * Sandbox Module
 *
 * SANDBOX_BACKEND env selects which manager to use:
 *   - scf: SCF function via CloudBase manager (legacy)
 *   - ags (default): AGS container via @cloudbase/manager-node
 *   - lightbox: Lightbox microVM (same as AGS for now)
 *
 * Uses if/else to pick the correct manager at module load time.
 */

import { getSandboxBackend } from './sandbox-backend.js'
import { scfSandboxManager as _scfManager } from './scf-sandbox-manager.js'
import { agsSandboxManager as _agsManager, SandboxInstance as AgsSandboxInstance } from './ags-sandbox-manager.js'

const backend = getSandboxBackend()

// Pick manager based on SANDBOX_BACKEND env
let _manager: any
if (backend === 'scf') {
  _manager = _scfManager
} else {
  // ags | lightbox — both use the AGS manager
  _manager = _agsManager
}

export const scfSandboxManager = _manager as typeof _agsManager

// Re-export the AGS SandboxInstance as canonical type (superset of what consumers need)
export { AgsSandboxInstance as SandboxInstance }
export type { SandboxMode, SandboxProgressCallback } from './ags-sandbox-manager.js'
export { AgsSandboxManager as ScfSandboxManager } from './ags-sandbox-manager.js'

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

export { getSandboxBackend, type SandboxBackend } from './sandbox-backend.js'
