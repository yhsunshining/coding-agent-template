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
import * as readline from 'readline'

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

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' | 'step' = 'info') {
  const prefix = {
    info: `${colors.cyan}→${colors.reset}`,
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warn: `${colors.yellow}!${colors.reset}`,
    step: `${colors.bright}▶${colors.reset}`,
  }[type]
  console.log(`${prefix} ${message}`)
}

function logSection(title: string) {
  console.log('')
  console.log(`${colors.bright}${colors.cyan}━━━ ${title} ━━━${colors.reset}`)
}

function runCommand(cmd: string, silent = false): string {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
    })
  } catch (error) {
    throw new Error(`Command failed: ${cmd}`)
  }
}

function runCommandSafe(cmd: string): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    return { success: true, output }
  } catch (error: any) {
    return { success: false, output: error.stdout || error.stderr || '' }
  }
}

async function promptInput(prompt: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    if (hidden) {
      // Raw mode: disable echo so password is not shown
      process.stdout.write(`${prompt}: `)
      process.stdin.setRawMode(true)
      process.stdin.resume()
      let password = ''
      const onData = (char: Buffer) => {
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

async function askYesNo(prompt: string, defaultValue = false): Promise<boolean> {
  const hint = defaultValue ? '[Y/n]' : '[y/N]'
  const answer = await promptInput(`${prompt} ${hint}`)
  if (!answer) return defaultValue
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
}

// ===================== Environment Checks =====================

function checkNodeVersion(): boolean {
  logSection('Checking Node.js')

  const nodeVersion = process.version.replace('v', '')
  const majorVersion = parseInt(nodeVersion.split('.')[0], 10)

  log(`Node.js version: ${process.version}`)

  if (majorVersion < MIN_NODE_VERSION) {
    log(`Node.js ${MIN_NODE_VERSION}+ is required, but found ${majorVersion}`, 'error')
    log('Please upgrade Node.js: https://nodejs.org/', 'info')
    return false
  }

  log(`Node.js ${majorVersion} meets requirements (>= ${MIN_NODE_VERSION})`, 'success')
  return true
}

async function checkPnpm(): Promise<boolean> {
  logSection('Checking pnpm')

  const result = runCommandSafe('pnpm --version')

  if (result.success) {
    log(`pnpm ${result.output.trim()} is installed`, 'success')
    return true
  }

  log('pnpm is not installed', 'warn')

  const install = await askYesNo('Install pnpm now?', true)
  if (!install) {
    log('pnpm is required for this project', 'error')
    return false
  }

  log('Installing pnpm via corepack...')
  try {
    runCommand('corepack enable && corepack prepare pnpm@latest --activate')
    log('pnpm installed successfully', 'success')
    return true
  } catch (error) {
    log('Failed to install pnpm via corepack, trying npm...', 'warn')
    try {
      runCommand('npm install -g pnpm')
      log('pnpm installed successfully', 'success')
      return true
    } catch (error2) {
      log('Failed to install pnpm', 'error')
      return false
    }
  }
}

// ===================== TCR Setup =====================

function loadEnvFile(): Record<string, string> {
  const env: Record<string, string> = {}
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

function saveEnvVar(key: string, value: string) {
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

function getCloudbaseCredential(): { uin: string; tmpSecretId: string; tmpSecretKey: string; tmpToken: string } | null {
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

async function runCloudbaseLogin(): Promise<boolean> {
  log('Running cloudbase login...')
  log('Please complete the login in your browser...', 'info')

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

async function setupTcr(): Promise<boolean> {
  logSection('Setting up TCR (Container Registry)')

  const env = loadEnvFile()

  // Check if already configured
  if (env['TCR_IMAGE']) {
    log('TCR already configured in .env.local', 'success')
    log(`Image: ${env['TCR_IMAGE']}`, 'info')
    return true
  }

  // Check cloudbase CLI
  const cloudbaseCheck = runCommandSafe('cloudbase --version')
  if (!cloudbaseCheck.success) {
    log('Installing cloudbase CLI...')
    try {
      runCommand('npm install -g @cloudbase/cli', true)
      log('cloudbase CLI installed', 'success')
    } catch {
      log('Failed to install cloudbase CLI', 'error')
      return false
    }
  }

  // Check credentials
  let cred = getCloudbaseCredential()
  if (!cred) {
    log('No valid cloudbase credentials found', 'warn')
    const loginSuccess = await runCloudbaseLogin()
    if (!loginSuccess) {
      log('Login failed', 'error')
      return false
    }
    cred = getCloudbaseCredential()
  }

  if (!cred) {
    log('Failed to get credentials', 'error')
    return false
  }

  log(`Using account: ${cred.uin}`, 'success')

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
  log('TCR (Container Registry) setup requires a password.', 'info')
  log("If you haven't set one, visit: https://console.cloud.tencent.com/tcr", 'info')
  log('', 'info')

  const savedPassword = env['TCR_PASSWORD']
  let password = ''

  if (savedPassword) {
    const useSaved = await askYesNo('Use saved TCR password?', true)
    if (useSaved) {
      password = savedPassword
    }
  }

  if (!password) {
    password = await promptInput('Enter your TCR password', true)
  }

  if (!password) {
    log('Password is required', 'error')
    return false
  }

  saveEnvVar('TCR_PASSWORD', password)

  // Run the full TCR setup script
  // Pass password via environment variable instead of CLI arg to avoid it appearing in process list
  log('Running TCR setup...')
  try {
    execSync('pnpm setup:tcr', {
      stdio: 'inherit',
      env: { ...process.env, TCR_PASSWORD: password },
    })
    log('TCR setup completed', 'success')
    return true
  } catch (error) {
    log('TCR setup failed. You may need to run it manually later.', 'warn')
    log('Run: pnpm setup:tcr', 'info')
    return false
  }
}

async function setupEnv(): Promise<boolean> {
  logSection('Setting up environment')

  if (existsSync(ENV_FILE)) {
    log('.env.local already exists', 'success')
    return true
  }

  // Create minimal .env.local
  const envContent = `# Environment variables
# Generated by init script

# Session Encryption (auto-generated)
JWE_SECRET=${require('crypto').randomBytes(32).toString('base64')}
ENCRYPTION_KEY=${require('crypto').randomBytes(32).toString('hex')}

# Auth Providers
NEXT_PUBLIC_AUTH_PROVIDERS=local

# Rate Limiting
MAX_MESSAGES_PER_DAY=50
MAX_SANDBOX_DURATION=300
`

  writeFileSync(ENV_FILE, envContent)
  log('Created .env.local with default values', 'success')
  return true
}

// ===================== Dependencies =====================

async function installDependencies(): Promise<boolean> {
  logSection('Installing dependencies')

  const result = runCommandSafe('pnpm install')

  if (result.success) {
    log('Dependencies installed successfully', 'success')
    return true
  }

  log('Failed to install dependencies', 'error')
  return false
}

// ===================== Main =====================

async function main() {
  console.log('')
  console.log(`${colors.bright}${colors.cyan}╔══════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}║     🚀 Project Initialization Script        ║${colors.reset}`)
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

  // Step 4: Setup TCR (optional)
  logSection('TCR Setup (optional)')
  const setupTcrNow = await askYesNo('Setup TCR container registry now?', true)
  if (setupTcrNow) {
    await setupTcr()
  } else {
    log('Skipping TCR setup. Run "pnpm setup:tcr" later if needed.', 'warn')
  }

  // Step 5: Install dependencies
  if (!(await installDependencies())) {
    process.exit(1)
  }

  // Done!
  console.log('')
  console.log(`${colors.bright}${colors.green}╔══════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.bright}${colors.green}║           ✅ Setup Complete!                 ║${colors.reset}`)
  console.log(`${colors.bright}${colors.green}╚══════════════════════════════════════════════╝${colors.reset}`)
  console.log('')
  console.log(`${colors.cyan}━━━ Development Mode ━━━${colors.reset}`)
  console.log('')
  console.log(`  ${colors.bright}pnpm dev${colors.reset}`)
  console.log('')
  console.log(`${colors.dim}Starts both web (port 5174) and server (port 3001)${colors.reset}`)
  console.log(`${colors.dim}Open http://localhost:5174 in your browser${colors.reset}`)
  console.log('')
  console.log(`${colors.cyan}━━━ Production Mode ━━━${colors.reset}`)
  console.log('')
  console.log(`  ${colors.bright}pnpm build${colors.reset}   ${colors.dim}# Build web and server${colors.reset}`)
  console.log(
    `  ${colors.bright}pnpm start${colors.reset}   ${colors.dim}# Start server (serves static files)${colors.reset}`,
  )
  console.log('')
  console.log(`${colors.dim}Server runs on port 3001, serves API and static files${colors.reset}`)
  console.log('')
  console.log(`${colors.cyan}━━━ Other Commands ━━━${colors.reset}`)
  console.log('')
  console.log(`${colors.dim}  pnpm dev:web     - Start web only${colors.reset}`)
  console.log(`${colors.dim}  pnpm dev:server  - Start server only${colors.reset}`)
  console.log(`${colors.dim}  pnpm lint        - Run linter${colors.reset}`)
  console.log(`${colors.dim}  pnpm type-check  - Check TypeScript types${colors.reset}`)
  console.log('')
}

main().catch((error) => {
  console.error('Initialization failed:', error)
  process.exit(1)
})
