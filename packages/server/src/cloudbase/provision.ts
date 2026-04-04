import tencentcloud from 'tencentcloud-sdk-nodejs'

const CamClient = tencentcloud.cam.v20190116.Client
const TcbClient = tencentcloud.tcb.v20180608.Client

/**
 * 构建用户环境的 CAM 策略 statement
 * 在 provision（创建永久策略）和 acp（签发临时密钥）中复用
 */
export function buildUserEnvPolicyStatements(envId: string) {
  return [
    {
      action: [
        'tcb:DescribeEnvs',
        'tcb:DescribePackages',
        'tcb:CheckTcbService',
        'tcb:DescribeBillingInfo',
        'tcb:DescribeEnvLimit',
        'tcb:GetUserKeyList',
        'tcb:DescribeMonitorMetric',
        'tcb:ListTables',
      ],
      effect: 'allow',
      resource: ['*'],
    },
    {
      action: ['tcb:*'],
      effect: 'allow',
      resource: [`qcs::tcb:::env/${envId}`],
    },
    {
      action: ['cos:*'],
      effect: 'allow',
      resource: ['*'],
    },
    {
      action: ['scf:*'],
      effect: 'allow',
      resource: ['*'],
    },
    {
      action: ['sts:GetFederationToken'],
      effect: 'allow',
      resource: ['*'],
    },
  ]
}

function getClients() {
  const credential = {
    secretId: process.env.TCB_SECRET_ID || process.env.TENCENT_SECRET_ID || '',
    secretKey: process.env.TCB_SECRET_KEY || process.env.TENCENT_SECRET_KEY || '',
    token: process.env.TCB_TOKEN || process.env.TENCENTCLOUD_SESSIONTOKEN || '',
  }

  const camClient = new CamClient({
    credential,
    region: '',
    profile: { httpProfile: { endpoint: 'cam.tencentcloudapi.com' } },
  })

  const tcbClient = new TcbClient({
    credential,
    region: 'ap-shanghai',
    profile: { httpProfile: { endpoint: 'tcb.tencentcloudapi.com' } },
  })

  return { camClient, tcbClient }
}

function generatePassword(length = 16): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const special = '!@#$%^&*()-_=+'
  const all = upper + lower + digits + special

  const password: string[] = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ]

  for (let i = password.length; i < length; i++) {
    password.push(all[Math.floor(Math.random() * all.length)])
  }

  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[password[i], password[j]] = [password[j], password[i]]
  }

  return password.join('')
}

export interface ProvisionResult {
  envId: string
  camUsername: string
  camSecretId: string
  camSecretKey?: string
  policyId: number
}

/**
 * 为新注册用户创建 CloudBase 资源：
 * 1. CAM 子账号
 * 2. API 密钥
 * 3. CloudBase 环境
 * 4. 权限策略（绑定到子账号）
 */
export async function provisionUserResources(userId: string, username: string): Promise<ProvisionResult> {
  const { camClient, tcbClient } = getClients()

  // 步骤1：创建 CAM 子账号
  const camUsername = `oc_${userId.substring(0, 20)}`
  let subAccountUin: number
  let password: string | undefined

  try {
    const getUserResp = await (camClient as any).GetUser({ Name: camUsername })
    subAccountUin = getUserResp.Uin
    // 子账号已存在，重置密码
    password = generatePassword()
    try {
      await (camClient as any).UpdateUser({
        Name: camUsername,
        ConsoleLogin: 1,
        Password: password,
        NeedResetPassword: 0,
      })
    } catch {
      password = undefined
    }
  } catch {
    // 创建新子账号
    password = generatePassword()
    const addUserResp = await (camClient as any).AddUser({
      Name: camUsername,
      Remark: `coder user: ${username}`,
      ConsoleLogin: 1,
      Password: password,
      NeedResetPassword: 0,
      UseApi: 0,
    })
    subAccountUin = addUserResp.Uin
  }

  // 步骤2：创建或获取 API 密钥
  let camSecretId: string
  let camSecretKey: string | undefined

  const listKeysResp = await (camClient as any).ListAccessKeys({ TargetUin: subAccountUin })
  const existingKeys: any[] = listKeysResp.AccessKeys || []
  const activeKey = existingKeys.find((k: any) => k.Status === 'Active')

  if (activeKey) {
    camSecretId = activeKey.AccessKeyId
  } else {
    const createKeyResp = await (camClient as any).CreateAccessKey({ TargetUin: subAccountUin })
    camSecretId = createKeyResp.AccessKey.AccessKeyId
    camSecretKey = createKeyResp.AccessKey.SecretAccessKey
  }

  // 步骤3：创建或获取 CloudBase 环境
  const envAlias = `coder-${userId.substring(0, 14)}`
  let envId: string | undefined

  try {
    const descResp = await (tcbClient as any).DescribeEnvs({})
    const found = (descResp.EnvList || []).find((e: any) => e.Alias === envAlias)
    if (found) envId = found.EnvId
  } catch {
    // 查询失败不阻塞
  }

  if (!envId) {
    const createEnvResp = await (tcbClient as any).CreateEnv({
      Alias: envAlias,
      PackageId: 'baas_personal',
      Resources: ['flexdb', 'storage', 'function'],
    })
    envId = createEnvResp.EnvId
  }

  // 步骤4：创建权限策略并绑定到子账号
  const policyName = `coder_policy_${envId}`
  let policyId: number | undefined

  try {
    const listResp = await (camClient as any).ListPolicies({ Keyword: policyName, Scope: 'Local' })
    const found = (listResp.List || []).find((p: any) => p.PolicyName === policyName)
    if (found) policyId = found.PolicyId
  } catch {
    // 查询失败不阻塞
  }

  if (!policyId) {
    const policyDocument = JSON.stringify({
      version: '2.0',
      statement: buildUserEnvPolicyStatements(envId!),
    })

    const createPolicyResp = await (camClient as any).CreatePolicy({
      PolicyName: policyName,
      PolicyDocument: policyDocument,
      Description: `Coder env ${envId} access`,
    })
    policyId = createPolicyResp.PolicyId
  }

  await (camClient as any).AttachUserPolicy({
    AttachUin: subAccountUin,
    PolicyId: policyId,
  })

  return {
    envId: envId!,
    camUsername,
    camSecretId,
    camSecretKey,
    policyId: policyId!,
  }
}
