#!/usr/bin/env node

/**
 * Project Initialization Script
 *
 * This script handles the complete project setup:
 * 1. Check Node.js version (>= 18)
 * 2. Check/install pnpm
 * 3. Setup TCR (container registry)
 * 4. Install dependencies
 * 5. Ready to start development
 */

import { execSync, spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'
import crypto from 'crypto'
import readline from 'readline'

// ===================== Constants =====================

const MIN_NODE_VERSION = 18
const ENV_FILE = resolve(process.cwd(), '.env.local')
const CLOUDBASE_AUTH_FILE = resolve(homedir(), '.config/.cloudbase/auth.json')

// ===================== Helper Functions =====================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

function log(message, type = 'info') {
  const prefix = {
    info: `${colors.cyan}→${colors.reset}`,
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warn: `${colors.yellow}!${colors.reset}`,
    step: `${colors.bright}▶${colors.reset}`,
  }[type]
  console.log(`${prefix} ${message}`)
}

function logSection(title) {
  console.log('')
  console.log(`${colors.bright}${colors.cyan}━━━ ${title} ━━━${colors.reset}`)
}

function runCommand(cmd, silent = false) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    })
  } catch (error) {
    throw new Error(`Command failed: ${cmd}`)
  }
}

function runCommandSafe(cmd) {
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    return { success: true, output }
  } catch (error) {
    return { success: false, output: error.stdout || error.stderr || '' }
  }
}

async function promptInput(prompt, hidden = false) {
  return new Promise((resolve) => {
    if (hidden) {
      // Raw mode: disable echo so password is not shown
      process.stdout.write(`${prompt}: `)
      process.stdin.setRawMode(true)
      process.stdin.resume()
      let password = ''
      const onData = (char) => {
        const c = char.toString('utf8')
        switch (c) {
          case '\n':
          case '\r':
          case '\u0004':
            process.stdin.setRawMode(false)
            process.stdin.pause()
            process.stdin.removeListener('data', onData)
            process.stdout.write('\n')
            resolve(password)
            break
          case '\u0003':
            process.exit()
            break
          default:
            if (c.charCodeAt(0) === 127) {
              password = password.slice(0, -1)
            } else {
              password += c
            }
            break
        }
      }
      process.stdin.on('data', onData)
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      rl.question(`${prompt}: `, (answer) => {
        rl.close()
        resolve(answer.trim())
      })
    }
  })
}

async function askYesNo(prompt, defaultValue = false) {
  const hint = defaultValue ? '[Y/n]' : '[y/N]'
  const answer = await promptInput(`${prompt} ${hint}`)
  if (!answer) return defaultValue
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
}

// ===================== Environment Checks =====================

function checkNodeVersion() {
  logSection('检查 Node.js')

  const nodeVersion = process.version.replace('v', '')
  const majorVersion = parseInt(nodeVersion.split('.')[0], 10)

  log(`Node.js 版本：${process.version}`)

  if (majorVersion < MIN_NODE_VERSION) {
    log(`需要 Node.js ${MIN_NODE_VERSION}+，当前版本为 ${majorVersion}`, 'error')
    log('请升级 Node.js：https://nodejs.org/', 'info')
    return false
  }

  log(`Node.js ${majorVersion} 满足要求（>= ${MIN_NODE_VERSION}）`, 'success')
  return true
}

async function checkPnpm() {
  logSection('检查 pnpm')

  const result = runCommandSafe('pnpm --version')

  if (result.success) {
    log(`pnpm ${result.output.trim()} 已安装`, 'success')
    return true
  }

  log('pnpm 未安装', 'warn')

  const install = await askYesNo('是否立即安装 pnpm？', true)
  if (!install) {
    log('本项目需要 pnpm', 'error')
    return false
  }

  log('正在通过 corepack 安装 pnpm...')
  try {
    runCommand('corepack enable && corepack prepare pnpm@latest --activate')
    log('pnpm 安装成功', 'success')
    return true
  } catch (error) {
    log('通过 corepack 安装失败，尝试使用 npm...', 'warn')
    try {
      runCommand('npm install -g pnpm')
      log('pnpm 安装成功', 'success')
      return true
    } catch (error2) {
      log('pnpm 安装失败', 'error')
      return false
    }
  }
}

function checkDocker() {
  logSection('检查 Docker')
  try {
    execSync('docker info', { stdio: 'pipe' })
    log('Docker 守护进程正在运行', 'success')
    return true
  } catch {
    log('Docker 守护进程未运行或未安装', 'error')
    log('请启动 Docker 后重试：', 'info')
    log('  colima start', 'info')
    log('  # 或打开 Docker Desktop', 'info')
    return false
  }
}

// ===================== TCR Setup =====================

function loadEnvFile() {
  const env = {}
  if (existsSync(ENV_FILE)) {
    const content = readFileSync(ENV_FILE, 'utf-8')
    content.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key) {
          env[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
  }
  return env
}

function saveEnvVar(key, value) {
  const env = loadEnvFile()

  if (env[key]) {
    const content = readFileSync(ENV_FILE, 'utf-8')
    const lines = content.split('\n')
    const newLines = lines.map((line) => {
      if (line.trim().startsWith(`${key}=`)) {
        return `${key}=${value}`
      }
      return line
    })
    writeFileSync(ENV_FILE, newLines.join('\n'))
  } else {
    const newline = env && Object.keys(env).length > 0 ? '\n' : ''
    const content = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf-8') : ''
    writeFileSync(ENV_FILE, `${content}${newline}${key}=${value}`)
  }
}

function getCloudbaseCredential() {
  if (!existsSync(CLOUDBASE_AUTH_FILE)) {
    return null
  }

  try {
    const content = readFileSync(CLOUDBASE_AUTH_FILE, 'utf-8')
    const auth = JSON.parse(content)

    if (!auth.credential?.tmpSecretId || !auth.credential?.tmpSecretKey) {
      return null
    }

    const now = Date.now()
    if (auth.credential.tmpExpired && now > auth.credential.tmpExpired) {
      return null
    }

    return {
      uin: auth.credential.uin,
      tmpSecretId: auth.credential.tmpSecretId,
      tmpSecretKey: auth.credential.tmpSecretKey,
      tmpToken: auth.credential.tmpToken,
    }
  } catch {
    return null
  }
}

async function runCloudbaseLogin() {
  log('正在执行 cloudbase 登录...')
  log('请在浏览器中完成登录...', 'info')

  return new Promise((resolve) => {
    const child = spawn('cloudbase', ['login'], {
      stdio: 'inherit',
      shell: true,
    })

    child.on('close', (code) => {
      resolve(code === 0)
    })

    child.on('error', () => {
      resolve(false)
    })
  })
}

async function setupCloudbaseConfig() {
  logSection('CloudBase 配置')

  const env = loadEnvFile()

  // ── 永久密钥询问 ──────────────────────────────────────────────
  // 已有永久密钥（有 SECRET_ID/KEY 且无 TOKEN）则跳过询问
  const hasPermanentKey = env['TCB_SECRET_ID'] && env['TCB_SECRET_KEY'] && !env['TCB_TOKEN']
  let usePermanentKey = hasPermanentKey

  if (!hasPermanentKey) {
    console.log('')
    console.log('  永久密钥无需 Token、不会过期，推荐用于本地开发。')
    console.log('  获取方式：腾讯云控制台 → 访问管理 → API 密钥管理')
    console.log('  https://console.cloud.tencent.com/cam/capi')
    console.log('')
    console.log('  如暂不填写，将使用 cloudbase login 临时凭证（按 Enter 跳过）。')
    console.log('')

    const secretId = await promptInput('SecretId（AKID 开头，回车跳过）')
    if (secretId) {
      const secretKey = await promptInput('SecretKey', true)
      if (secretKey) {
        saveEnvVar('TCB_SECRET_ID', secretId)
        saveEnvVar('TCB_SECRET_KEY', secretKey)
        saveEnvVar('TCB_TOKEN', '')
        log('永久密钥已保存', 'success')

        // 使用永久密钥登录 cloudbase CLI
        log('正在使用永久密钥登录 cloudbase CLI...')
        try {
          execSync(`cloudbase login --apiKeyId "${secretId}" --apiKey "${secretKey}"`, {
            stdio: 'pipe',
            encoding: 'utf-8',
          })
          log('cloudbase CLI 登录成功', 'success')
        } catch (e) {
          log('cloudbase CLI 登录失败，请检查密钥是否正确', 'warn')
        }

        // 获取账号 ID
        try {
          const auth = JSON.parse(readFileSync(CLOUDBASE_AUTH_FILE, 'utf-8'))
          const uin = auth?.credential?.uin
          if (uin) {
            saveEnvVar('TENCENTCLOUD_ACCOUNT_ID', uin)
            log(`账号 ID：${uin}`, 'info')
          }
        } catch { /* ignore */ }

        usePermanentKey = true
      } else {
        log('SecretKey 为空，跳过永久密钥', 'warn')
      }
    } else {
      log('跳过永久密钥，将使用 cloudbase 临时凭证', 'info')
    }
  } else {
    log(`已检测到永久密钥（${env['TCB_SECRET_ID'].slice(0, 10)}...）`, 'success')
  }

  // ── Token check ──────────────────────────────────────────────
  // 永久密钥无需 token；临时凭证需要保存 token
  let token = env['TCB_TOKEN'] || ''
  if (!usePermanentKey) {
    if (!token && existsSync(CLOUDBASE_AUTH_FILE)) {
      try {
        const auth = JSON.parse(readFileSync(CLOUDBASE_AUTH_FILE, 'utf-8'))
        const tmpToken = auth?.credential?.tmpToken
        if (tmpToken) {
          saveEnvVar('TCB_TOKEN', tmpToken)
          token = tmpToken
          log('已从 cloudbase 凭证中保存 TCB_TOKEN', 'success')
        }
      } catch { /* ignore */ }
    }

    if (!token) {
      log('TCB_TOKEN 未设置（临时凭证必填）', 'warn')
      token = await promptInput('请输入 TCB_TOKEN（使用永久密钥可直接回车跳过）', false)
      if (token) {
        saveEnvVar('TCB_TOKEN', token)
        log('TCB_TOKEN 已保存', 'success')
      }
    } else {
      log('TCB_TOKEN 已设置', 'success')
    }
  }

  // ── TCB_ENV_ID selection ──────────────────────────────────────
  const existingEnvId = env['TCB_ENV_ID'] || ''
  if (existingEnvId) {
    log(`TCB_ENV_ID 已设置：${existingEnvId}`, 'success')
    return true
  }

  log('正在获取 CloudBase 环境列表...')
  let envList = []
  try {
    const output = execSync('cloudbase env list --json 2>/dev/null', {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    const jsonStart = output.indexOf('{')
    if (jsonStart !== -1) {
      const parsed = JSON.parse(output.slice(jsonStart))
      envList = (parsed.data || []).filter(e => e.status === 'NORMAL')
    }
  } catch {
    log('无法从 cloudbase CLI 获取环境列表', 'warn')
  }

  let selectedEnvId = ''

  if (envList.length === 0) {
    log('未找到可用的 CloudBase 环境', 'warn')
    console.log('')
    console.log('  使用以下命令创建：cloudbase env:create <envName>')
    console.log('  然后重新运行 ./init，或在下方输入已有的 envId。')
    console.log('')
    selectedEnvId = await promptInput('请输入 TCB_ENV_ID')
  } else {
    console.log('')
    console.log('可用的 CloudBase 环境：')
    envList.forEach((e, i) => console.log(`  ${i + 1}) ${e.envId}`))
    console.log(`  c) 创建新环境`)
    console.log('')

    while (!selectedEnvId) {
      const answer = await promptInput('请选择环境（输入序号或 c）')
      if (!answer) continue

      if (answer.toLowerCase() === 'c') {
        console.log('')
        console.log('运行：cloudbase env:create <envName>')
        console.log('然后重新运行 ./init，或在下方输入新的 envId。')
        console.log('')
        selectedEnvId = await promptInput('请输入新的 TCB_ENV_ID')
      } else {
        const idx = parseInt(answer, 10) - 1
        if (idx >= 0 && idx < envList.length) {
          selectedEnvId = envList[idx].envId
        } else {
          log('选择无效，请重试', 'warn')
        }
      }
    }
  }

  if (!selectedEnvId) {
    log('TCB_ENV_ID 为必填项', 'error')
    return false
  }

  saveEnvVar('TCB_ENV_ID', selectedEnvId)
  log(`TCB_ENV_ID 已保存：${selectedEnvId}`, 'success')

  // ── TCB_PROVISION_MODE 选择 ───────────────────────────────────
  const existingMode = loadEnvFile()['TCB_PROVISION_MODE'] || ''
  if (existingMode) {
    log(`TCB_PROVISION_MODE 已设置：${existingMode}`, 'success')
  } else {
    console.log('')
    console.log('━━━ 用户环境模式 ━━━')
    console.log('')
    console.log('  1) 共享模式（shared）— 默认推荐')
    console.log('     所有用户共用同一个 CloudBase 环境，无需额外资源。')
    console.log('')
    console.log('  2) 独立模式（isolated）')
    console.log('     每个用户自动创建独立的 CloudBase 环境。')
    console.log('     ⚠ 需要账号有足够余额，且密钥具备 CAM 权限。')
    console.log('')

    let mode = ''
    while (!mode) {
      const answer = await promptInput('请选择模式（1 或 2，回车默认选 1）')
      if (!answer || answer === '1') {
        mode = 'shared'
      } else if (answer === '2') {
        mode = 'isolated'
      } else {
        log('请输入 1 或 2', 'warn')
      }
    }

    saveEnvVar('TCB_PROVISION_MODE', mode)
    log(`TCB_PROVISION_MODE 已保存：${mode}`, 'success')
  }

  return true
}

async function setupTcr() {
  logSection('配置 TCR（容器镜像服务）')

  const env = loadEnvFile()

  // Check if already configured
  if (env['TCR_IMAGE']) {
    log('TCR 已在 .env.local 中配置', 'success')
    log(`镜像：${env['TCR_IMAGE']}`, 'info')
    return true
  }

  // Check cloudbase CLI
  const cloudbaseCheck = runCommandSafe('cloudbase --version')
  if (!cloudbaseCheck.success) {
    log('正在安装 cloudbase CLI...')
    try {
      runCommand('npm install -g @cloudbase/cli', true)
      log('cloudbase CLI 安装成功', 'success')
    } catch {
      log('cloudbase CLI 安装失败', 'error')
      return false
    }
  }

  // Check credentials
  let cred = getCloudbaseCredential()
  if (!cred) {
    log('未找到有效的 cloudbase 凭证', 'warn')
    const loginSuccess = await runCloudbaseLogin()
    if (!loginSuccess) {
      log('登录失败', 'error')
      return false
    }
    cred = getCloudbaseCredential()
  }

  if (!cred) {
    log('获取凭证失败', 'error')
    return false
  }

  log(`使用账号：${cred.uin}`, 'success')

  // Create .env.local if not exists
  if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, '# Environment variables\n')
  }

  // Save credentials
  saveEnvVar('TCB_SECRET_ID', cred.tmpSecretId)
  saveEnvVar('TCB_SECRET_KEY', cred.tmpSecretKey)
  saveEnvVar('TENCENTCLOUD_ACCOUNT_ID', cred.uin)

  // Ask for TCR password
  log('', 'info')
  log('配置 TCR（容器镜像服务）需要密码。', 'info')
  log('如未设置密码，请访问：https://console.cloud.tencent.com/tcr', 'info')
  log('', 'info')

  const savedPassword = env['TCR_PASSWORD']
  let password = ''

  if (savedPassword) {
    const useSaved = await askYesNo('使用已保存的 TCR 密码？', true)
    if (useSaved) {
      password = savedPassword
    }
  }

  if (!password) {
    password = await promptInput('请输入 TCR 密码', true)
  }

  if (!password) {
    log('密码为必填项', 'error')
    return false
  }

  saveEnvVar('TCR_PASSWORD', password)

  // Run the full TCR setup script
  // Pass password via environment variable instead of CLI arg to avoid it appearing in process list
  log('正在运行 TCR 配置脚本...')
  try {
    execSync('node scripts/setup-tcr.mjs', {
      stdio: 'inherit',
      env: { ...process.env, TCR_PASSWORD: password },
    })
    log('TCR 配置完成', 'success')
    return true
  } catch (error) {
    log('TCR 配置失败，可稍后手动执行。', 'warn')
    log('运行：node scripts/setup-tcr.mjs', 'info')
    return false
  }
}

async function setupEnv() {
  logSection('配置环境变量')

  if (existsSync(ENV_FILE)) {
    log('.env.local 已存在', 'success')
    return true
  }

  // Create minimal .env.local
  const envContent = `# Environment variables
# Generated by init script

# Session Encryption (auto-generated)
JWE_SECRET=${crypto.randomBytes(32).toString('base64')}
ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}

# Auth Providers
NEXT_PUBLIC_AUTH_PROVIDERS=local

# Rate Limiting
MAX_MESSAGES_PER_DAY=50
MAX_SANDBOX_DURATION=300
`

  writeFileSync(ENV_FILE, envContent)
  log('已创建 .env.local（使用默认值）', 'success')
  return true
}

// ===================== Server Environment =====================

async function setupServerEnv() {
  logSection('配置服务端环境变量')

  const env = loadEnvFile()
  const serverEnvFile = resolve(process.cwd(), 'packages/server/.env')

  // 读取已有的 server/.env（用于保留 CodeBuddy / Git Archive 等手动配置的值）
  const existingServerEnv = {}
  if (existsSync(serverEnvFile)) {
    readFileSync(serverEnvFile, 'utf-8').split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=')
        if (key) existingServerEnv[key.trim()] = rest.join('=').trim()
      }
    })

    const overwrite = await askYesNo('packages/server/.env 已存在，是否覆盖？（否则跳过此步骤）', true)
    if (!overwrite) {
      log('跳过服务端环境变量配置', 'info')
      return true
    }
  }

  // 常规 key：root .env.local 优先
  const get = (key, fallback = '') => env[key] || process.env[key] || fallback

  // 保留型 key：优先读已有 server/.env，没有再用静态默认值
  const getPreserved = (key, fallback = '') => existingServerEnv[key] || fallback

  const jweSecret = get('JWE_SECRET')
  const encryptionKey = get('ENCRYPTION_KEY')

  if (!jweSecret || !encryptionKey) {
    log('.env.local 中缺少加密密钥', 'warn')
    return false
  }

  const serverEnv = `# Server Environment Configuration
# Generated by init script

# ==================== Required ====================

JWE_SECRET=${jweSecret}
ENCRYPTION_KEY=${encryptionKey}

# ==================== Server Configuration ====================

PORT=3001
NODE_ENV=development

# ==================== Rate Limiting ====================

MAX_MESSAGES_PER_DAY=${get('MAX_MESSAGES_PER_DAY', '50')}
MAX_SANDBOX_DURATION=${get('MAX_SANDBOX_DURATION', '300')}

# ==================== Auth ====================

NEXT_PUBLIC_AUTH_PROVIDERS=${get('NEXT_PUBLIC_AUTH_PROVIDERS', 'local')}

# ==================== CloudBase ====================

TCB_ENV_ID=${get('TCB_ENV_ID')}
TCB_SECRET_ID=${get('TCB_SECRET_ID')}
TCB_SECRET_KEY=${get('TCB_SECRET_KEY')}
TCB_TOKEN=${get('TCB_TOKEN')}
TCB_PROVISION_MODE=${get('TCB_PROVISION_MODE', 'shared')}

# ==================== CodeBuddy OAuth & Git Archive ====================

CODEBUDDY_CLIENT_ID=${getPreserved('CODEBUDDY_CLIENT_ID')}
CODEBUDDY_CLIENT_SECRET=${getPreserved('CODEBUDDY_CLIENT_SECRET')}
CODEBUDDY_OAUTH_ENDPOINT=${getPreserved('CODEBUDDY_OAUTH_ENDPOINT', 'https://copilot.tencent.com/oauth2/token')}

GIT_ARCHIVE_REPO=${getPreserved('GIT_ARCHIVE_REPO')}
GIT_ARCHIVE_USER=${getPreserved('GIT_ARCHIVE_USER')}
GIT_ARCHIVE_TOKEN=${getPreserved('GIT_ARCHIVE_TOKEN')}

# ==================== SCF Sandbox ====================

SCF_SANDBOX_IMAGE_TYPE=${get('SCF_SANDBOX_IMAGE_TYPE', 'personal')}
SCF_SANDBOX_IMAGE_URI=${get('TCR_IMAGE')}
SCF_SANDBOX_IMAGE_ACCELERATE=${get('SCF_SANDBOX_IMAGE_ACCELERATE', 'false')}
SCF_SANDBOX_IMAGE_PORT=${get('SCF_SANDBOX_IMAGE_PORT', '9000')}
SCF_SANDBOX_TEST_URL=${get('SCF_SANDBOX_TEST_URL')}

# ==================== GitHub OAuth (Optional) ====================

# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=

# ==================== Proxy (Optional) ====================

# http_proxy=
`

  writeFileSync(serverEnvFile, serverEnv)
  log('服务端配置已写入 packages/server/.env', 'success')
  return true
}

// ===================== Dependencies =====================

async function installDependencies() {
  logSection('安装依赖')

  const result = runCommandSafe('pnpm install')

  if (!result.success) {
    log('依赖安装失败', 'error')
    return false
  }

  log('依赖安装成功', 'success')

  // 重新编译原生模块（better-sqlite3 需要针对当前 Node.js 版本编译）
  log('正在编译原生模块...', 'info')
  try {
    // 动态查找 better-sqlite3 目录，避免写死版本号
    const { execSync: exec } = await import('child_process')
    const pkgDir = exec(
      'node -e "console.log(require.resolve(\'better-sqlite3/package.json\').replace(\'/package.json\', \'\'))"',
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim()

    const rebuild = runCommandSafe(`npm run build-release --prefix "${pkgDir}"`)
    if (rebuild.success) {
      log('原生模块编译成功', 'success')
    } else {
      log('原生模块编译失败，如遇到 better-sqlite3 错误请手动运行：', 'warn')
      log('  pnpm rebuild better-sqlite3', 'info')
    }
  } catch (e) {
    log('未找到 better-sqlite3，跳过原生模块编译', 'warn')
  }

  return true
}

// ===================== Main =====================

async function main() {
  console.log('')
  console.log(`${colors.bright}${colors.cyan}╔══════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}║        🚀 项目初始化脚本                    ║${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}╚══════════════════════════════════════════════╝${colors.reset}`)
  console.log('')

  // Step 1: Check Node.js
  if (!checkNodeVersion()) {
    process.exit(1)
  }

  // Step 2: Check/install pnpm
  if (!(await checkPnpm())) {
    process.exit(1)
  }

  // Step 3: Setup environment (.env.local)
  if (!(await setupEnv())) {
    process.exit(1)
  }

  // Step 4: Check Docker (required for TCR image push)
  if (!checkDocker()) {
    process.exit(1)
  }

  // Step 5: CloudBase configuration (TCB_ENV_ID + token)
  if (!(await setupCloudbaseConfig())) {
    process.exit(1)
  }

  // Step 6: Setup TCR
  logSection('TCR 配置')
  await setupTcr()

  // Step 6: Setup Server Environment
  if (!(await setupServerEnv())) {
    process.exit(1)
  }

  // Step 7: Install dependencies
  if (!(await installDependencies())) {
    process.exit(1)
  }

  // Done!
  console.log('')
  console.log(`${colors.bright}${colors.green}╔══════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.bright}${colors.green}║           ✅ 初始化完成！                   ║${colors.reset}`)
  console.log(`${colors.bright}${colors.green}╚══════════════════════════════════════════════╝${colors.reset}`)
  console.log('')
  console.log(`${colors.bright}${colors.yellow}━━━ 启动前请填写必要配置项 ━━━${colors.reset}`)
  console.log('')
  console.log(`打开 ${colors.bright}packages/server/.env${colors.reset} 并填写以下内容：`)
  console.log('')
  console.log(`  ${colors.bright}CodeBuddy OAuth${colors.reset} — 用于用户认证`)
  console.log(`  ${colors.dim}CODEBUDDY_CLIENT_ID=       # 你的 CodeBuddy OAuth 应用 client ID${colors.reset}`)
  console.log(`  ${colors.dim}CODEBUDDY_CLIENT_SECRET=   # 你的 CodeBuddy OAuth 应用 client secret${colors.reset}`)
  console.log(`  ${colors.dim}CODEBUDDY_OAUTH_ENDPOINT=https://copilot.tencent.com/oauth2/token${colors.reset}`)
  console.log('')
  console.log(`  ${colors.bright}Git Archive (CNB)${colors.reset} — 用于工作区 git 归档`)
  console.log(`  ${colors.dim}GIT_ARCHIVE_REPO=   # 例如 https://cnb.cool/<org>/<repo>${colors.reset}`)
  console.log(`  ${colors.dim}GIT_ARCHIVE_USER=   # 你的 CNB 用户名${colors.reset}`)
  console.log(`  ${colors.dim}GIT_ARCHIVE_TOKEN=  # 个人访问令牌${colors.reset}`)
  console.log('')
  console.log(`  ${colors.cyan}→ 在以下地址创建仓库和令牌：https://cnb.cool${colors.reset}`)
  console.log(`  ${colors.dim}  1. 新建一个用于工作区归档的仓库${colors.reset}`)
  console.log(`  ${colors.dim}  2. 进入「设置」→「访问令牌」→「新建令牌」（需读写权限）${colors.reset}`)
  console.log('')
  console.log(`${colors.cyan}━━━ 开发模式 ━━━${colors.reset}`)
  console.log('')
  console.log(`  ${colors.bright}pnpm dev${colors.reset}`)
  console.log('')
  console.log(`${colors.dim}同时启动前端（端口 5174）和服务端（端口 3001）${colors.reset}`)
  console.log(`${colors.dim}在浏览器中打开 http://localhost:5174${colors.reset}`)
  console.log('')
  console.log(`${colors.cyan}━━━ 生产模式 ━━━${colors.reset}`)
  console.log('')
  console.log(`  ${colors.bright}pnpm build${colors.reset}   ${colors.dim}# 构建前端和服务端${colors.reset}`)
  console.log(
    `  ${colors.bright}pnpm start${colors.reset}   ${colors.dim}# 启动服务端（同时托管静态文件）${colors.reset}`,
  )
  console.log('')
  console.log(`${colors.dim}服务端运行在端口 3001，提供 API 及静态文件服务${colors.reset}`)
  console.log('')
  console.log(`${colors.cyan}━━━ 其他命令 ━━━${colors.reset}`)
  console.log('')
  console.log(`${colors.dim}  pnpm dev:web     - 仅启动前端${colors.reset}`)
  console.log(`${colors.dim}  pnpm dev:server  - 仅启动服务端${colors.reset}`)
  console.log(`${colors.dim}  pnpm lint        - 运行代码检查${colors.reset}`)
  console.log(`${colors.dim}  pnpm type-check  - 检查 TypeScript 类型${colors.reset}`)
  console.log('')
}

main().catch((error) => {
  console.error('初始化失败：', error)
  process.exit(1)
})
