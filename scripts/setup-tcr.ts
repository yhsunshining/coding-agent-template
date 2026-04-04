#!/usr/bin/env node

/**
 * TCR Personal Edition Setup Script
 *
 * This script initializes the Tencent Cloud Container Registry (TCR) Personal Edition
 * and pushes images to the registry. It handles:
 * 1. Automatic cloudbase CLI installation (if needed)
 * 2. Automatic cloudbase login (if needed)
 * 3. Environment variable validation and generation
 * 4. TCR Personal Edition initialization (CreateUserPersonal)
 * 5. Namespace creation with random suffix (to avoid global conflicts)
 * 6. Docker login and image push
 *
 * Credentials can be obtained from:
 * - cloudbase-cli login state (temporary credentials, for local development)
 * - Permanent API keys (for production deployment)
 */

import { execSync, spawn } from 'child_process'
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'
import * as crypto from 'crypto'
import * as readline from 'readline'

// Use require for tencentcloud-sdk-nodejs due to ESM/CJS compatibility
const tencentcloud = require('tencentcloud-sdk-nodejs')

// ===================== Types =====================

interface SetupConfig {
  // Tencent Cloud credentials
  secretId: string
  secretKey: string
  token?: string // For temporary credentials
  accountId: string

  // TCR configuration
  region: string
  namespace: string
  namespacePrefix: string // Base namespace without suffix
  visibility: 'private' | 'public'

  // Docker configuration
  localImage: string
  repoName: string
  tag: string

  // Password for TCR (will be generated if not provided)
  password?: string

  // Flag to indicate if using temporary credentials
  isTemporaryCredential?: boolean

  // Skip cloudbase login check
  skipCloudbaseLogin?: boolean
}

interface CloudbaseCredential {
  credential: {
    uin: string
    tokenId: string
    tmpSecretId: string
    tmpSecretKey: string
    tmpExpired: number
    expired: number
    authTime: number
    refreshToken: string
    tmpToken: string
  }
}

interface NamespaceInfo {
  Namespace: string
  CreationTime?: string
  Public?: boolean
}

// ===================== Constants =====================

const TCR_DOMAIN = 'ccr.ccs.tencentyun.com'
const ENV_FILE = resolve(process.cwd(), '.env.local')
const CLOUDBASE_AUTH_FILE = resolve(homedir(), '.config/.cloudbase/auth.json')
const DEFAULT_NAMESPACE_PREFIX = 'cloudbase-vibecoding'

// ===================== Helper Functions =====================

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const prefix = {
    info: '→',
    success: '✓',
    error: '✗',
    warn: '!',
  }[type]
  console.log(`${prefix} ${message}`)
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

function generatePassword(): string {
  // Generate a password that meets TCR requirements:
  // 8-16 characters, includes uppercase, lowercase, numbers, and special characters
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const special = '!@#$%^&*'

  const all = uppercase + lowercase + numbers + special

  let password = ''
  // Ensure at least one of each type (4 chars)
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]

  // Fill rest with random characters (6 more = 10 total, within 8-16 range)
  for (let i = 0; i < 6; i++) {
    password += all[Math.floor(Math.random() * all.length)]
  }

  // Shuffle password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

/**
 * Generate a 4-character random suffix for namespace
 */
function generateNamespaceSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return suffix
}

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
    // Update existing value
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
    // Append new value
    appendFileSync(ENV_FILE, `\n${key}=${value}`)
  }
}

/**
 * Prompt user for input
 */
function promptInput(prompt: string, hidden = false): Promise<string> {
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

/**
 * Ask user yes/no question
 */
async function askYesNo(prompt: string, defaultValue = false): Promise<boolean> {
  const hint = defaultValue ? '[Y/n]' : '[y/N]'
  const answer = await promptInput(`${prompt} ${hint}`)
  if (!answer) return defaultValue
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
}

// ===================== Cloudbase CLI Functions =====================

/**
 * Check if cloudbase CLI is installed
 */
function isCloudbaseInstalled(): boolean {
  try {
    execSync('which cloudbase', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Install cloudbase CLI globally
 */
async function installCloudbase(): Promise<boolean> {
  log('Installing cloudbase CLI...')

  try {
    execSync('npm install -g @cloudbase/cli', { stdio: 'inherit' })
    log('cloudbase CLI installed successfully', 'success')
    return true
  } catch (error) {
    log(`Failed to install cloudbase CLI: ${error}`, 'error')
    return false
  }
}

/**
 * Run cloudbase login interactively
 * This will open a browser for user to authorize
 */
async function runCloudbaseLogin(): Promise<boolean> {
  log('Running cloudbase login...')
  log('Please complete the login in your browser...', 'info')

  return new Promise((resolve) => {
    // Use spawn to run cloudbase login interactively
    const child = spawn('cloudbase', ['login'], {
      stdio: 'inherit',
      shell: true,
    })

    child.on('close', (code) => {
      if (code === 0) {
        log('cloudbase login completed', 'success')
        resolve(true)
      } else {
        log(`cloudbase login exited with code ${code}`, 'error')
        resolve(false)
      }
    })

    child.on('error', (error) => {
      log(`Failed to run cloudbase login: ${error.message}`, 'error')
      resolve(false)
    })
  })
}

/**
 * Get credentials from cloudbase-cli login state
 * This allows using temporary credentials from `cloudbase login`
 */
function getCloudbaseCredential(): CloudbaseCredential | null {
  if (!existsSync(CLOUDBASE_AUTH_FILE)) {
    return null
  }

  try {
    const content = readFileSync(CLOUDBASE_AUTH_FILE, 'utf-8')
    const auth = JSON.parse(content) as CloudbaseCredential

    // Check if credential exists and not expired
    if (!auth.credential?.tmpSecretId || !auth.credential?.tmpSecretKey) {
      return null
    }

    // Check expiration (tmpExpired is in milliseconds)
    const now = Date.now()
    if (auth.credential.tmpExpired && now > auth.credential.tmpExpired) {
      log('Cloudbase credential has expired', 'warn')
      return null
    }

    return auth
  } catch (error) {
    log(`Failed to read cloudbase credential`, 'warn')
    return null
  }
}

/**
 * Ensure cloudbase CLI is installed and user is logged in
 */
async function ensureCloudbaseAuth(skipLogin = false): Promise<CloudbaseCredential | null> {
  // Step 1: Check if cloudbase CLI is installed
  if (!isCloudbaseInstalled()) {
    log('cloudbase CLI not found', 'warn')
    const installed = await installCloudbase()
    if (!installed) {
      return null
    }
  } else {
    log('cloudbase CLI is installed', 'success')
  }

  // Step 2: Check if already logged in
  let credential = getCloudbaseCredential()

  if (credential) {
    log('Found valid cloudbase credentials', 'success')
    return credential
  }

  // Step 3: If not logged in, run login (unless skipped)
  if (skipLogin) {
    log('Cloudbase login skipped', 'warn')
    return null
  }

  log('No valid cloudbase credentials found', 'warn')
  const loginSuccess = await runCloudbaseLogin()

  if (!loginSuccess) {
    return null
  }

  // Step 4: Get credentials after login
  credential = getCloudbaseCredential()
  return credential
}

// ===================== TCR SDK Functions =====================

const TcrClient = (tencentcloud as any).tcr.v20190924.Client

function createTcrClient(secretId: string, secretKey: string, region: string, token?: string) {
  const credential: { secretId: string; secretKey: string; token?: string } = {
    secretId,
    secretKey,
  }

  // Add token for temporary credentials
  if (token) {
    credential.token = token
  }

  return new TcrClient({
    credential,
    region,
    profile: {
      httpProfile: {
        endpoint: 'tcr.tencentcloudapi.com',
      },
    },
  })
}

/**
 * Check if TCR Personal Edition user already exists
 */
async function checkUserExists(client: any): Promise<boolean> {
  try {
    // DescribeUserPersonal will succeed if user exists
    await client.DescribeUserPersonal({})
    return true
  } catch (error: any) {
    // If user doesn't exist, it will return an error
    if (error.code === 'ResourceNotFound' || error.message?.includes('not found')) {
      return false
    }
    // For other errors, assume user exists (let other operations handle the error)
    return true
  }
}

/**
 * Initialize TCR Personal Edition with password
 * Returns true if successful, false otherwise
 * Returns 'exists' if user already exists
 */
async function initTcrPersonal(client: any, password: string): Promise<{ success: boolean; userExists: boolean }> {
  log('Initializing TCR Personal Edition...')

  try {
    await client.CreateUserPersonal({
      Password: password,
    })
    log('TCR Personal Edition initialized successfully', 'success')
    return { success: true, userExists: false }
  } catch (error: any) {
    if (error.code === 'ResourceInUse' || error.message?.includes('already')) {
      log('TCR Personal Edition user already exists', 'warn')
      return { success: true, userExists: true }
    }
    log(`Failed to initialize TCR Personal Edition: ${error.message}`, 'error')
    return { success: false, userExists: false }
  }
}

/**
 * List all namespaces for the user
 */
async function listNamespaces(client: any, prefix?: string): Promise<NamespaceInfo[]> {
  try {
    const result = await client.DescribeNamespacePersonal({
      Namespace: prefix || '',
      Limit: 100,
      Offset: 0,
    })
    return (result?.Data?.NamespaceInfo || []).map((ns: any) => ({ Namespace: ns.Namespace }))
  } catch (error: any) {
    log(`Failed to list namespaces: ${error.code} - ${error.message}`, 'warn')
    return []
  }
}

/**
 * Find namespace by prefix
 */
async function findNamespaceByPrefix(client: any, prefix: string): Promise<string | null> {
  const namespaces = await listNamespaces(client, prefix)
  const found = namespaces.find((ns) => ns.Namespace.startsWith(prefix))
  return found?.Namespace || null
}

/**
 * Create namespace with random suffix
 * Returns the full namespace name
 */
async function createNamespaceWithSuffix(client: any, prefix: string, maxRetries = 10): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    const suffix = generateNamespaceSuffix()
    const namespace = `${prefix}-${suffix}`

    log(`Creating namespace '${namespace}'...`)

    try {
      await client.CreateNamespacePersonal({
        Namespace: namespace,
      })
      log(`Namespace '${namespace}' created successfully`, 'success')
      return namespace
    } catch (error: any) {
      if (error.code?.startsWith('LimitExceeded')) {
        log(`Namespace limit reached: ${error.message}`, 'error')
        log('Please delete an existing namespace at: https://console.cloud.tencent.com/tcr/namespace', 'info')
        return null
      }
      if (
        error.code === 'ResourceInUse' ||
        error.code === 'FailedOperation.AlreadyExists' ||
        error.message?.includes('already') ||
        error.message?.includes('exist')
      ) {
        log(`Namespace '${namespace}' already taken globally, trying another suffix...`, 'warn')
        continue
      }
      log(`Failed to create namespace: ${error.code} - ${error.message}`, 'error')
      return null
    }
  }

  log('Failed to create namespace after multiple attempts', 'error')
  return null
}

/**
 * Reset TCR password for existing user
 * Note: TCR Personal Edition doesn't have a reset password API
 * Users need to reset password through Tencent Cloud Console
 */
async function resetTcrPassword(_client: any, _password: string): Promise<boolean> {
  log('TCR Personal Edition does not support resetting password via API.', 'error')
  log('Please reset your password at:', 'info')
  log('  https://console.cloud.tencent.com/tcr', 'info')
  return false
}

// ===================== Docker Functions =====================

function dockerLogin(domain: string, username: string, password: string): boolean {
  log('Logging in to TCR registry...')

  try {
    // Use docker login with password-stdin for security
    runCommand(`echo '${password}' | docker login ${domain} --username ${username} --password-stdin`, true)
    log('Docker login successful', 'success')
    return true
  } catch (error) {
    log('Docker login failed', 'error')
    log('This may be due to incorrect password.', 'warn')
    log('If you forgot your password, please reset it at: https://console.cloud.tencent.com/tcr', 'info')
    return false
  }
}

function pullImage(image: string): boolean {
  log(`Pulling image '${image}'...`)

  try {
    runCommand(`docker pull ${image}`)
    log(`Image '${image}' pulled successfully`, 'success')
    return true
  } catch (error) {
    log(`Failed to pull image '${image}'`, 'error')
    return false
  }
}

function tagImage(sourceImage: string, targetImage: string): boolean {
  log(`Tagging image '${sourceImage}' -> '${targetImage}'...`)

  try {
    runCommand(`docker tag ${sourceImage} ${targetImage}`, true)
    log('Image tagged successfully', 'success')
    return true
  } catch (error) {
    log('Failed to tag image', 'error')
    return false
  }
}

function pushImage(image: string): boolean {
  log(`Pushing image '${image}'...`)

  try {
    runCommand(`docker push ${image}`)
    log(`Image '${image}' pushed successfully`, 'success')
    return true
  } catch (error) {
    log('Failed to push image', 'error')
    return false
  }
}

// ===================== Setup Functions =====================

async function validateAndPrepareEnv(config: SetupConfig): Promise<boolean> {
  log('Validating credentials...')

  const env = loadEnvFile()

  // Step 1: Try command line arguments first
  if (config.secretId && config.secretKey && config.accountId) {
    log('Using credentials from command line arguments', 'success')
    return true
  }

  // Step 2: Try cloudbase-cli auth.json (preferred for temporary credentials, includes token)
  if (!config.skipCloudbaseLogin) {
    const cloudbaseCred = await ensureCloudbaseAuth(false)
    if (cloudbaseCred) {
      config.secretId = cloudbaseCred.credential.tmpSecretId
      config.secretKey = cloudbaseCred.credential.tmpSecretKey
      config.token = cloudbaseCred.credential.tmpToken
      config.accountId = cloudbaseCred.credential.uin
      config.isTemporaryCredential = true
      log('Using temporary credentials from cloudbase-cli login', 'success')
      log(`Account ID: ${config.accountId}`, 'info')
      return true
    }
  }

  // Step 3: Try explicit environment variables + session token
  // Note: token is only read from process.env (not .env.local) to avoid persisting stale tokens
  if (!config.secretId) {
    const envValue =
      process.env.TCB_SECRET_ID ||
      process.env.TENCENTCLOUD_SECRET_ID ||
      env['TCB_SECRET_ID'] ||
      env['TENCENTCLOUD_SECRET_ID']
    if (envValue) config.secretId = envValue
  }
  if (!config.secretKey) {
    const envValue =
      process.env.TCB_SECRET_KEY ||
      process.env.TENCENTCLOUD_SECRET_KEY ||
      env['TCB_SECRET_KEY'] ||
      env['TENCENTCLOUD_SECRET_KEY']
    if (envValue) config.secretKey = envValue
  }
  if (!config.accountId) {
    const envValue = process.env.TENCENTCLOUD_ACCOUNT_ID || env['TENCENTCLOUD_ACCOUNT_ID']
    if (envValue) config.accountId = envValue
  }
  if (!config.token) {
    const tokenValue = process.env.TCB_SESSION_TOKEN || process.env.TENCENTCLOUD_SESSION_TOKEN
    if (tokenValue) {
      config.token = tokenValue
      config.isTemporaryCredential = true
    }
  }

  if (config.secretId && config.secretKey && config.accountId) {
    if (config.isTemporaryCredential && !config.token) {
      log('Temporary credentials found but missing session token (TCB_SESSION_TOKEN)', 'warn')
      log('Temporary credentials require a session token to authenticate', 'error')
      return false
    }
    log('Using credentials from environment variables', 'success')
    return true
  }

  // Step 4 (fallback): No credentials found
  log('No valid credentials found', 'error')
  log('', 'info')
  log('Please provide credentials via:', 'info')
  log('  1. Command line: --secret-id, --secret-key, --account-id', 'info')
  log('  2. Environment variables: TCB_SECRET_ID, TCB_SECRET_KEY, TENCENTCLOUD_ACCOUNT_ID', 'info')
  log('  3. cloudbase login (will be prompted automatically)', 'info')
  return false
}

function generateSecrets() {
  log('Generating secrets for local development...')

  const env = loadEnvFile()

  if (!env['JWE_SECRET']) {
    const jweSecret = crypto.randomBytes(32).toString('base64')
    saveEnvVar('JWE_SECRET', jweSecret)
    log('Generated JWE_SECRET', 'success')
  } else {
    log('JWE_SECRET already exists', 'warn')
  }

  if (!env['ENCRYPTION_KEY']) {
    const encryptionKey = crypto.randomBytes(32).toString('hex')
    saveEnvVar('ENCRYPTION_KEY', encryptionKey)
    log('Generated ENCRYPTION_KEY', 'success')
  } else {
    log('ENCRYPTION_KEY already exists', 'warn')
  }
}

async function setupTcr(config: SetupConfig): Promise<boolean> {
  const client = createTcrClient(config.secretId, config.secretKey, config.region, config.token)

  // Step 1: Get password from config or env
  const env = loadEnvFile()
  let password = config.password || env['TCR_PASSWORD']
  const hasPasswordFromCli = !!config.password // Track if password came from CLI

  // Step 2: Check if TCR user already exists
  const userExists = await checkUserExists(client)

  if (userExists) {
    // User exists
    log('TCR Personal Edition user already exists.', 'warn')

    // If password provided from CLI, use it directly
    if (hasPasswordFromCli) {
      log('Using provided password for TCR login', 'info')
    } else if (!password) {
      // No password available, need to ask user
      if (env['TCR_PASSWORD']) {
        const useSaved = await askYesNo('Use saved password from .env.local?', true)
        if (useSaved) {
          password = env['TCR_PASSWORD']
        }
      }

      if (!password) {
        log('', 'info')
        log('No password available. You can:', 'info')
        log('  1. Enter your TCR password below', 'info')
        log('  2. Reset password at: https://console.cloud.tencent.com/tcr', 'info')
        log('', 'info')

        const enterPassword = await askYesNo('Do you want to enter your TCR password?', true)
        if (enterPassword) {
          password = await promptInput('Enter your TCR password', true)
        } else {
          log('Please reset your password in Tencent Cloud Console and run this script again.', 'error')
          return false
        }
      }
    }
  } else {
    // New user, need to initialize with password
    if (!password) {
      password = generatePassword()
      log('Generated new TCR password', 'info')
    }

    // Initialize TCR Personal Edition
    const initResult = await initTcrPersonal(client, password)
    if (!initResult.success) {
      return false
    }
  }

  if (!password) {
    log('Password is required', 'error')
    return false
  }

  // Save TCR password
  saveEnvVar('TCR_PASSWORD', password)
  log('TCR password saved to .env.local', 'info')

  // Step 3: Find or create namespace
  let namespace: string | null = null

  // First, try to find existing namespace by prefix
  log(`Looking for existing namespace with prefix '${config.namespacePrefix}'...`)
  namespace = await findNamespaceByPrefix(client, config.namespacePrefix)

  if (namespace) {
    log(`Found existing namespace: ${namespace}`, 'success')
  } else {
    // Create new namespace with random suffix
    log(`No existing namespace found with prefix '${config.namespacePrefix}'`, 'info')
    namespace = await createNamespaceWithSuffix(client, config.namespacePrefix)
    if (!namespace) {
      return false
    }
  }

  // Save namespace to config
  config.namespace = namespace
  saveEnvVar('TCR_NAMESPACE', namespace)
  log(`Namespace saved to .env.local: ${namespace}`, 'info')

  // Step 4: Docker login
  if (!dockerLogin(TCR_DOMAIN, config.accountId, password)) {
    return false
  }

  // Step 5: Pull local image (optional, skip if already exists)
  log(`Checking for local image '${config.localImage}'...`)
  try {
    runCommand(`docker inspect ${config.localImage}`, true)
    log('Local image found', 'success')
  } catch {
    log('Local image not found, pulling...')
    if (!pullImage(config.localImage)) {
      return false
    }
  }

  // Step 6: Tag image
  const fullImage = `${TCR_DOMAIN}/${config.namespace}/${config.repoName}:${config.tag}`
  if (!tagImage(config.localImage, fullImage)) {
    return false
  }

  // Step 7: Push image
  if (!pushImage(fullImage)) {
    return false
  }

  // Save image reference
  saveEnvVar('TCR_IMAGE', fullImage)
  log(`Image reference saved: ${fullImage}`, 'info')

  return true
}

// ===================== Main =====================

async function main() {
  console.log('\n🔧 TCR Personal Edition Setup Script\n')

  // Parse command line arguments
  const args = process.argv.slice(2)
  const config: SetupConfig = {
    secretId: process.env.TCB_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID || '',
    secretKey: process.env.TCB_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY || '',
    accountId: process.env.TENCENTCLOUD_ACCOUNT_ID || '',
    // Token for temporary credentials: read from env only, never persisted to disk
    token: process.env.TCB_SESSION_TOKEN || process.env.TENCENTCLOUD_SESSION_TOKEN || undefined,
    isTemporaryCredential: !!(process.env.TCB_SESSION_TOKEN || process.env.TENCENTCLOUD_SESSION_TOKEN),
    region: 'ap-guangzhou', // Personal edition only supports Guangzhou
    namespace: '',
    namespacePrefix: DEFAULT_NAMESPACE_PREFIX,
    visibility: 'private',
    localImage: 'ghcr.io/yhsunshining/cloudbase-workspace:latest',
    repoName: 'sandbox',
    tag: 'latest',
    // Password from env var (passed by init.ts to avoid exposing in process list)
    password: process.env.TCR_PASSWORD || undefined,
  }

  // Parse arguments
  const env = loadEnvFile()
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--secret-id':
        config.secretId = args[++i]
        break
      case '--secret-key':
        config.secretKey = args[++i]
        break
      case '--account-id':
        config.accountId = args[++i]
        break
      case '--namespace':
        config.namespacePrefix = args[++i]
        break
      case '--visibility':
        config.visibility = args[++i] as 'private' | 'public'
        break
      case '--local-image':
        config.localImage = args[++i]
        break
      case '--repo-name':
        config.repoName = args[++i]
        break
      case '--tag':
        config.tag = args[++i]
        break
      case '--password':
        config.password = args[++i]
        break
      case '--skip-cloudbase-login':
        config.skipCloudbaseLogin = true
        break
      case '--help':
      case '-h':
        console.log(`
Usage: tsx scripts/setup-tcr.ts [options]

Options:
  --secret-id <id>        Tencent Cloud Secret ID (optional if cloudbase login)
  --secret-key <key>      Tencent Cloud Secret Key (optional if cloudbase login)
  --account-id <id>       Tencent Cloud Account ID (optional if cloudbase login)
  --namespace <prefix>    TCR namespace prefix (default: ${DEFAULT_NAMESPACE_PREFIX})
                          A 4-char random suffix will be added automatically
  --visibility <type>     Namespace visibility: private (default) or public
  --local-image <image>   Local Docker image to push (default: ghcr.io/yhsunshining/cloudbase-workspace:latest)
  --repo-name <name>      Repository name in TCR (default: sandbox)
  --tag <tag>             Image tag (default: latest)
  --password <pwd>        TCR login password
  --skip-cloudbase-login  Skip automatic cloudbase login
  --help, -h              Show this help message

Namespace Behavior:
  - Namespace is globally unique across all TCR Personal Edition users
  - Script will first search for existing namespace with the given prefix
  - If not found, creates a new one with random 4-char suffix (e.g., prefix-a1b2)
  - Namespace is saved to .env.local for future use

Credential Sources (in order of priority):
  1. Command line arguments (--secret-id, --secret-key, --account-id)
  2. Environment variables (TCB_SECRET_ID, TCB_SECRET_KEY, TENCENTCLOUD_ACCOUNT_ID)
  3. cloudbase-cli login state (automatic installation and login if needed)

Image Configuration from .env.local:
  TCR_LOCAL_IMAGE    Local Docker image to push (default: ghcr.io/yhsunshining/cloudbase-workspace:latest)
  TCR_REPO_NAME      Repository name in TCR (default: sandbox)
  TCR_TAG            Image tag (default: latest)

Examples:
  # Simple usage (will auto-install cloudbase and login if needed)
  pnpm setup:tcr

  # Custom namespace prefix
  pnpm setup:tcr --namespace my-app

  # With explicit credentials (skip cloudbase login)
  pnpm setup:tcr \\
    --secret-id YOUR_SECRET_ID \\
    --secret-key YOUR_SECRET_KEY \\
    --account-id 123456789

  # Custom image
  pnpm setup:tcr \\
    --namespace my-app \\
    --local-image node:20 \\
    --repo-name my-app \\
    --tag v1.0.0
`)
        process.exit(0)
    }
  }

  // Apply env defaults for image config (CLI args take priority)
  if (config.localImage === 'ghcr.io/yhsunshining/cloudbase-workspace:latest') {
    config.localImage = env['TCR_LOCAL_IMAGE'] || 'ghcr.io/yhsunshining/cloudbase-workspace:latest'
  }
  if (config.repoName === 'sandbox') {
    config.repoName = env['TCR_REPO_NAME'] || 'sandbox'
  }
  if (config.tag === 'latest') {
    config.tag = env['TCR_TAG'] || 'latest'
  }

  // Validate environment
  if (!(await validateAndPrepareEnv(config))) {
    process.exit(1)
  }

  // Ensure .env.local exists
  if (!existsSync(ENV_FILE)) {
    log(`Creating ${ENV_FILE}...`)
    writeFileSync(ENV_FILE, '# Environment variables\n')
  }

  // Generate secrets for local development
  generateSecrets()

  // Run TCR setup
  const success = await setupTcr(config)

  if (success) {
    console.log('\n✅ Setup completed successfully!\n')
    console.log('Your image is available at:')
    console.log(`  ${TCR_DOMAIN}/${config.namespace}/${config.repoName}:${config.tag}\n`)
    console.log('Environment variables have been saved to .env.local')
  } else {
    console.log('\n❌ Setup failed. Please check the errors above.\n')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Setup failed with error:', error)
  process.exit(1)
})
