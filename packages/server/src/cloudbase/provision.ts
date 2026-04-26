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
        'cam:CreateRole',
        'cam:AttachRolePolicy',
        'cam:ListAttachedRolePolicies',
        'cam:UpdatePolicy',
        'cam:CreateServiceLinkedRole',
        'cam:DescribeServiceLinkedRole',
        'cam:GetRole',
        'cdn:TcbCheckResource',
        'organization:DescribeCloudApplicationToMember',
        'vpc:DescribeVpcEx',
        'tandon:GetEnabledNpsConfigDetail',
        'tcbr:DescribeArchitectureType',
        'tcbr:DescribeEnvBaseInfo',
        'tcbr:DescribeUserServiceTermsRecord',
        'tcbr:DescribeArchitectureType',
        'lowcode:GetUserTicket',
        'lowcode:GetUserCertifyInfo',
        'lowcode:DescribeUserCompositeGroupsList',
        'lowcode:DescribeWedaWxBind',
        'lowcode:GetProxyAddr',
        'lowcode:GetMaxAppNum',
        'lowcode:DescribeApps',
        'lowcode:DescribeKnowledgeSetList',
        'lowcode:GetUserCertifyInfo',
        'tcb:DescribeAgentList',
        'tcb:GetTemplateAPIsList',
        'tcb:DescribeTenant',
        'tcb:CheckTcbService',
        'tcb:GetApisGroupAndList',
        'tcb:DescribePackages',
        'tcb:DescribeEnvLimit',
        'tcb:GetUserKeyList',
        'tcb:DescribeBillingInfo',
        'tcb:DescribeExtensionsInstalled',
        'tcb:DescribeCloudBaseRunAdvancedConfiguration',
        'tcb:DescribeCloudBaseProjectLatestVersionList',
        'tcb:DescribeExtensions',
        'tcb:DescribePostPackage',
        'tcb:DescribeICPResources',
        'tcb:DescribeExtensionUpgrade',
        'tcb:DescribeMonitorMetric',
        'tcb:DescribeLowCodeUserQuotaUsage',
        'tcb:DescribeEnvStatistics',
        'tcb:DescribeLowCodeEnvQuotaUsage',
        'tcb:CheckFeaturePermission',
        'tcb:DescribeCommonBillingResources',
        'tcb:DescribeCommonBillingPackages',
        'tcb:DescribeEnvBacklogs',
        'tcb:DescribeEnvRestriction',
        'tcb:DescribeUserPromotionalActivity',
        'tcb:DescribeFeaturePermissions',
        'tcb:RefreshAuthDomain',
        'tcb:DescribeActivityInfo',
        'tcb:DescribeTcbAccountInfo',
        'tcb:DescribeUserPromotionalActivity',
        'tcb:DescribeAIModels',
        'tcb:DescribeOperationAppTemplates',
        'tcb:DescribeSolutionList',
        'tcb:DescribeCloudBaseRunBaseImages',
        'tcb:DescribeBuildServiceList',
        'tcb:DescribeVmInstances',
        'tcb:ListTables',
        'tcb:DescribeRestoreTime',
        'tcb:DescribeRestoreTask',
        'tcb:DescribeExtraPackages',
      ],
      effect: 'allow',
      resource: ['*'],
    },
    {
      action: ['tcb:*'],
      effect: 'allow',
      resource: [`qcs::tcb:::env/${envId}`],
    },
    // 某些 tcb 顶层 action(如 tcb:CreateFunction / tcb:QueryRecords)在
    // CloudBase 内部以主账号为鉴权范围,不以 envId 作为资源限制,必须 resource: *。
    // 单独列出避免整体 tcb:* 打到全资源造成过度授权。合法 action 名参见 CAM
    // UpdatePolicy 探测结果。
    {
      action: [
        'tcb:CreateFunction',
        'tcb:UpdateFunctionCode',
        'tcb:GetFunction',
        'tcb:InvokeFunction',
        'tcb:ListFunctions',
        // 云数据库(NoSQL) 记录操作,同样走主账号鉴权
        'tcb:QueryRecords',
        'tcb:PutItem',
        'tcb:UpdateItem',
        'tcb:DeleteItem',
        'tcb:CreateTable',
      ],
      effect: 'allow',
      resource: ['*'],
    },
    {
      action: ['tcbr:*'],
      effect: 'allow',
      resource: [`qcs::tcbr:::env/${envId}`],
    },
    {
      action: ['lowcode:*'],
      effect: 'allow',
      resource: [`qcs::lowcode:::env/${envId}`],
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
    // flexdb:* 不是合法 CAM service,CAM UpdatePolicy 会返回
    // "Invalid service for action: flexdb:*" 并拒绝整个 policy。
    // CloudBase 数据库(云开发数据库)的访问走 `tcb:*` 与 envId 资源级别鉴权,已覆盖。
    {
      action: ['cls:*'],
      effect: 'allow',
      resource: ['*'],
    },
    {
      action: ['ssl:DescribeCertificateDetail', 'ssl:DescribeCertificates'],
      effect: 'allow',
      resource: ['*'],
    },
    // {
    //   action: ['sts:GetFederationToken'],
    //   effect: 'allow',
    //   resource: ['*'],
    // },
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
  const camUsername = `vibe_${userId.substring(0, 20)}`
  let subAccountUin: number
  let password: string | undefined
  // 步骤2：创建或获取 API 密钥
  let camSecretId: string = ''
  let camSecretKey: string = ''

  try {
    console.log('[provision] Checking existing CAM user')
    const getUserResp = await (camClient as any).GetUser({ Name: camUsername })
    subAccountUin = getUserResp.Uin
    // 子账号已存在，重置密码
    password = generatePassword()
    try {
      console.log('[provision] Updating CAM user password')

      await (camClient as any).UpdateUser({
        Name: camUsername,
        ConsoleLogin: 0,
        Password: password,
        NeedResetPassword: 0,
        UseApi: 1,
      })
    } catch {
      password = undefined
    }
  } catch {
    // 创建新子账号
    password = generatePassword()
    console.log('[provision] Creating CAM user')
    try {
      const addUserResp = await (camClient as any).AddUser({
        Name: camUsername,
        Remark: `coder user ${userId} ${username}`,
        ConsoleLogin: 0,
        Password: password,
        NeedResetPassword: 0,
        UseApi: 1,
      })
      subAccountUin = addUserResp.Uin
      if (addUserResp.SecretId) {
        camSecretId = addUserResp.SecretId
        camSecretKey = addUserResp.SecretKey
      }
    } catch (e) {
      console.error('[provision] CAM user creation failed:', e)
      throw e
    }
  }

  if (!camSecretId) {
    console.log('[provision] Creating access key')
    const createKeyResp = await (camClient as any).CreateAccessKey({ TargetUin: subAccountUin })
    camSecretId = createKeyResp.AccessKey.AccessKeyId
    camSecretKey = createKeyResp.AccessKey.SecretAccessKey
  }

  // 步骤3：创建 CloudBase 环境（每个用户独立环境）
  let envId: string

  console.log('[provision] Creating CloudBase env')
  const createEnvResp = await (tcbClient as any).CreateEnv({
    Alias: 'coder',
    PackageId: 'baas_personal',
    Resources: ['flexdb', 'storage', 'function'],
  })
  envId = createEnvResp.EnvId

  // 步骤4：创建权限策略并绑定到子账号
  const policyName = `coder_policy_${envId}`
  let policyId: number | undefined

  try {
    console.log('[provision] Listing policies')
    const listResp = await (camClient as any).ListPolicies({ Keyword: policyName, Scope: 'Local' })
    const found = (listResp.List || []).find((p: any) => p.PolicyName === policyName)
    if (found) policyId = found.PolicyId
  } catch {
    // 查询失败不阻塞
  }

  if (!policyId) {
    const policyDocument = JSON.stringify({
      version: '2.0',
      statement: buildUserEnvPolicyStatements(envId),
    })

    console.log('[provision] Creating policy')
    const createPolicyResp = await (camClient as any).CreatePolicy({
      PolicyName: policyName,
      PolicyDocument: policyDocument,
      Description: 'Coder env access',
    })
    policyId = createPolicyResp.PolicyId
  }

  console.log('[provision] Attaching user policy')
  await (camClient as any).AttachUserPolicy({
    AttachUin: subAccountUin,
    PolicyId: policyId,
  })

  return {
    envId: envId,
    camUsername,
    camSecretId,
    camSecretKey,
    policyId: policyId!,
  }
}

/**
 * 回滚 provisionUserResources 创建的腾讯云资源（注册失败时使用）
 * 不销毁环境，仅清理 CAM 资源
 */
export async function rollbackProvisionedResources(result: Partial<ProvisionResult>): Promise<void> {
  const { camClient } = getClients()

  if (result.policyId) {
    try {
      await (camClient as any).DeletePolicy({ PolicyId: [result.policyId] })
    } catch {
      // best-effort
    }
  }

  if (result.camUsername) {
    try {
      await (camClient as any).DeleteUser({ Name: result.camUsername, Force: 1 })
    } catch {
      // best-effort
    }
  }
}

/**
 * 删除用户时完整清理腾讯云资源（CAM 子用户 + 策略 + 云开发环境）
 * 尽力清理，单项失败不阻塞其他操作
 */
export async function destroyProvisionedResources(resource: {
  camUsername?: string | null
  policyId?: number | null
  envId?: string | null
}): Promise<void> {
  const { camClient, tcbClient } = getClients()

  // 删除 CAM 策略
  if (resource.policyId) {
    try {
      await (camClient as any).DeletePolicy({ PolicyId: [resource.policyId] })
      console.log('[provision] CAM policy deleted')
    } catch {
      // best-effort
    }
  }

  // 删除 CAM 子账号（级联删除 API 密钥）
  if (resource.camUsername) {
    try {
      await (camClient as any).DeleteUser({ Name: resource.camUsername, Force: 1 })
      console.log('[provision] CAM user deleted')
    } catch {
      // best-effort
    }
  }

  // 销毁 CloudBase 环境
  if (resource.envId && resource.envId !== process.env.TCB_ENV_ID) {
    // 不删除支撑环境（shared 模式下 envId === TCB_ENV_ID）
    try {
      await (tcbClient as any).DestroyEnv({ EnvId: resource.envId })
      console.log('[provision] CloudBase env destroyed')
    } catch (e) {
      console.log('[provision] CloudBase env destroy error:', e)
      // best-effort
    }
  }
}
